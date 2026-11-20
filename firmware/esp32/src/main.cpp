/* ==============================================================================
 * SRNE Solar Station Wireless Bridge & Resilient Offline Data Logger
 * Target: ESP32 (ESP32-WROOM-32, ESP32-S3, ESP32-C3)
 * Features:
 *   - Hardware Watchdog Timer (WDT) with 30s auto-recovery
 *   - Hardware UART2 Modbus RTU at 9600 baud with DE/RE direction pin
 *   - Full-time WebSocket server on port 80 (/ws)
 *   - LittleFS Flash FIFO Ring Buffer: logs offline whenever WiFi/client drops
 *   - Auto-sync on client reconnect: streams offline records in batches
 *   - Embedded HTTP status page + mDNS (srne-bridge.local)
 * ============================================================================== */

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <esp_task_wdt.h>
#include <time.h>

// --- User Configuration ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* HOSTNAME  = "srne-bridge";

#define RS485_RX_PIN   16
#define RS485_TX_PIN   17
#define RS485_DERE_PIN 4
#define MODBUS_BAUD    9600
#define SLAVE_ID       1

#define POLL_INTERVAL_MS        1000
#define OFFLINE_LOG_INTERVAL_MS 5000
#define WDT_TIMEOUT_SECONDS     30
#define OFFLINE_FILE            "/offline_log.bin"
#define MAX_OFFLINE_BYTES       (1536 * 1024) // 1.5 MB reserve for offline telemetry

// Compact binary record for LittleFS (32 bytes per record)
struct __attribute__((packed)) TelemetryRecord {
  uint32_t timestamp;
  uint16_t pvVoltage10x;
  uint16_t pvCurrent10x;
  uint16_t pvPower;
  uint16_t batVoltage10x;
  int16_t  batCurrent10x;
  uint8_t  batSoc;
  int8_t   batTemp;
  uint16_t acVolts10x;
  uint16_t acPower;
  uint16_t loadPct10x;
  int8_t   heatsinkTemp;
  uint16_t gridVolts10x;
  uint16_t gridPower;
  uint16_t faultCode;
};

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
HardwareSerial SerialModbus(2);

TelemetryRecord currentTelemetry;
bool hasValidTelemetry = false;
unsigned long lastPollTime = 0;
unsigned long lastOfflineLogTime = 0;
uint32_t offlineRecordCount = 0;
bool isSyncing = false;
uint32_t activeClientId = 0;

uint16_t calculateCRC16(const uint8_t *data, uint16_t length) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return crc;
}

bool readSrneHoldingRegisters() {
  uint8_t request[8];
  request[0] = SLAVE_ID;
  request[1] = 0x03;
  request[2] = 0x01;
  request[3] = 0x00;
  request[4] = 0x00;
  request[5] = 0x18;

  uint16_t crc = calculateCRC16(request, 6);
  request[6] = crc & 0xFF;
  request[7] = (crc >> 8) & 0xFF;

  while (SerialModbus.available()) SerialModbus.read();

  digitalWrite(RS485_DERE_PIN, HIGH);
  delayMicroseconds(50);
  SerialModbus.write(request, 8);
  SerialModbus.flush();
  digitalWrite(RS485_DERE_PIN, LOW);

  const int expectedLen = 5 + 48;
  uint8_t response[64];
  int bytesRead = 0;
  unsigned long startWait = millis();

  while (bytesRead < expectedLen && (millis() - startWait < 400)) {
    if (SerialModbus.available()) {
      response[bytesRead++] = SerialModbus.read();
    } else {
      delayMicroseconds(100);
    }
  }

  if (bytesRead < expectedLen) return false;

  uint16_t respCrc = calculateCRC16(response, expectedLen - 2);
  uint16_t packetCrc = response[expectedLen - 2] | (response[expectedLen - 1] << 8);
  if (respCrc != packetCrc) return false;

  currentTelemetry.timestamp = (uint32_t)time(nullptr);
  if (currentTelemetry.timestamp < 1000000000) currentTelemetry.timestamp = millis() / 1000;

  currentTelemetry.pvVoltage10x  = (response[3] << 8) | response[4];
  currentTelemetry.pvCurrent10x  = (response[5] << 8) | response[6];
  currentTelemetry.pvPower       = (response[7] << 8) | response[8];
  currentTelemetry.batVoltage10x = (response[9] << 8) | response[10];
  currentTelemetry.batCurrent10x = (int16_t)((response[11] << 8) | response[12]);
  currentTelemetry.batSoc        = response[14];
  currentTelemetry.batTemp       = (int8_t)response[16];
  currentTelemetry.heatsinkTemp  = (int8_t)response[18];
  currentTelemetry.gridVolts10x  = (response[21] << 8) | response[22];
  currentTelemetry.acVolts10x    = (response[25] << 8) | response[26];
  currentTelemetry.acPower       = (response[29] << 8) | response[30];
  currentTelemetry.loadPct10x    = (response[33] << 8) | response[34];
  currentTelemetry.faultCode     = (response[47] << 8) | response[48];

  hasValidTelemetry = true;
  return true;
}

void appendOfflineRecord(const TelemetryRecord &rec) {
  File file = LittleFS.open(OFFLINE_FILE, "a");
  if (!file) {
    Serial.println("[FS] Failed to open offline log for append");
    return;
  }

  if (file.size() > MAX_OFFLINE_BYTES) {
    file.close();
    Serial.println("[FS] Buffer full: dropping oldest block for FIFO rollover");
    LittleFS.remove("/offline_log_temp.bin");
    File src = LittleFS.open(OFFLINE_FILE, "r");
    File dst = LittleFS.open("/offline_log_temp.bin", "w");
    if (src && dst) {
      src.seek(sizeof(TelemetryRecord) * 200);
      uint8_t buf[256];
      while (src.available()) {
        int r = src.read(buf, sizeof(buf));
        dst.write(buf, r);
      }
      src.close();
      dst.close();
      LittleFS.remove(OFFLINE_FILE);
      LittleFS.rename("/offline_log_temp.bin", OFFLINE_FILE);
    }
    file = LittleFS.open(OFFLINE_FILE, "a");
  }

  file.write((const uint8_t*)&rec, sizeof(TelemetryRecord));
  file.close();
  offlineRecordCount++;
}

void countOfflineRecords() {
  if (LittleFS.exists(OFFLINE_FILE)) {
    File file = LittleFS.open(OFFLINE_FILE, "r");
    if (file) {
      offlineRecordCount = file.size() / sizeof(TelemetryRecord);
      file.close();
    }
  } else {
    offlineRecordCount = 0;
  }
}

void streamOfflineSyncBatch(AsyncWebSocketClient *client) {
  if (!LittleFS.exists(OFFLINE_FILE)) {
    client->text("{\"type\":\"sync_complete\",\"records\":0}");
    isSyncing = false;
    return;
  }

  File file = LittleFS.open(OFFLINE_FILE, "r");
  if (!file || file.size() == 0) {
    client->text("{\"type\":\"sync_complete\",\"records\":0}");
    if (file) file.close();
    LittleFS.remove(OFFLINE_FILE);
    offlineRecordCount = 0;
    isSyncing = false;
    return;
  }

  isSyncing = true;
  const size_t batchSize = 40;
  TelemetryRecord batch[batchSize];
  size_t totalRecords = file.size() / sizeof(TelemetryRecord);
  size_t processed = 0;

  while (file.available() && client->status() == WS_CONNECTED) {
    size_t count = 0;
    while (count < batchSize && file.read((uint8_t*)&batch[count], sizeof(TelemetryRecord))) {
      count++;
    }
    if (count == 0) break;

    StaticJsonDocument<4096> doc;
    doc["type"] = "sync_batch";
    doc["progress_pct"] = (int)((float)(processed + count) / totalRecords * 100);
    doc["remaining"] = totalRecords - (processed + count);

    JsonArray arr = doc.createNestedArray("records");
    for (size_t i = 0; i < count; i++) {
      JsonObject item = arr.createNestedObject();
      item["t"]     = batch[i].timestamp;
      item["pv_w"]  = batch[i].pvPower;
      item["pv_v"]  = batch[i].pvVoltage10x * 0.1f;
      item["soc"]   = batch[i].batSoc;
      item["bat_v"] = batch[i].batVoltage10x * 0.1f;
      item["bat_w"] = (int)(batch[i].batVoltage10x * 0.1f * batch[i].batCurrent10x * 0.1f);
      item["ac_w"]  = batch[i].acPower;
      item["temp"]  = batch[i].heatsinkTemp;
    }

    String output;
    serializeJson(doc, output);
    client->text(output);

    processed += count;
    esp_task_wdt_reset();
    delay(20);
  }

  file.close();
  LittleFS.remove(OFFLINE_FILE);
  offlineRecordCount = 0;
  isSyncing = false;

  client->text("{\"type\":\"sync_complete\",\"records\":" + String(processed) + "}");
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    activeClientId = client->id();

    StaticJsonDocument<512> doc;
    doc["type"] = "status";
    doc["chip"] = "ESP32";
    doc["firmware"] = "SRNE-Bridge-v2.4-RockSolid";
    doc["rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["uptime_s"] = millis() / 1000;
    doc["offline_records"] = offlineRecordCount;
    doc["wdt_active"] = true;

    String resp;
    serializeJson(doc, resp);
    client->text(resp);

    if (offlineRecordCount > 0) {
      streamOfflineSyncBatch(client);
    }
  } else if (type == WS_EVT_DISCONNECT) {
    if (activeClientId == client->id()) activeClientId = 0;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL);

  pinMode(RS485_DERE_PIN, OUTPUT);
  digitalWrite(RS485_DERE_PIN, LOW);
  SerialModbus.begin(MODBUS_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

  if (LittleFS.begin(true)) {
    countOfflineRecords();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long startWifi = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWifi < 12000) {
    delay(500);
    esp_task_wdt_reset();
  }

  if (WiFi.status() == WL_CONNECTED && MDNS.begin(HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
  }

  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    String html = "<html><head><title>SRNE ESP32 Bridge</title></head><body style='font-family:sans-serif;padding:30px;background:#0f172a;color:#f8fafc;'>"
      "<h2>SRNE Solar Station Wireless Bridge (ESP32)</h2>"
      "<p>Uptime: " + String(millis() / 1000) + "s | Free Heap: " + String(ESP.getFreeHeap()) + " bytes</p>"
      "<p>WiFi RSSI: " + String(WiFi.RSSI()) + " dBm | IP: " + WiFi.localIP().toString() + "</p>"
      "<p>Flash Backlog Queue: " + String(offlineRecordCount) + " records</p>"
      "<p>WebSocket Endpoint: <code>ws://" + WiFi.localIP().toString() + "/ws</code></p>"
      "</body></html>";
    request->send(200, "text/html", html);
  });

  server.begin();
}

void loop() {
  esp_task_wdt_reset();
  unsigned long now = millis();

  if (now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    if (readSrneHoldingRegisters() && ws.count() > 0 && !isSyncing) {
      StaticJsonDocument<512> doc;
      doc["type"]       = "telemetry";
      doc["pv_v"]       = currentTelemetry.pvVoltage10x * 0.1f;
      doc["pv_a"]       = currentTelemetry.pvCurrent10x * 0.1f;
      doc["pv_w"]       = currentTelemetry.pvPower;
      doc["bat_v"]      = currentTelemetry.batVoltage10x * 0.1f;
      doc["bat_a"]      = currentTelemetry.batCurrent10x * 0.1f;
      doc["soc"]        = currentTelemetry.batSoc;
      doc["bat_temp"]   = currentTelemetry.batTemp;
      doc["heatsink"]   = currentTelemetry.heatsinkTemp;
      doc["grid_v"]     = currentTelemetry.gridVolts10x * 0.1f;
      doc["ac_v"]       = currentTelemetry.acVolts10x * 0.1f;
      doc["ac_w"]       = currentTelemetry.acPower;
      doc["load_pct"]   = currentTelemetry.loadPct10x * 0.1f;
      doc["fault"]      = currentTelemetry.faultCode;
      doc["rssi"]       = WiFi.RSSI();
      doc["queue_size"] = offlineRecordCount;

      String msg;
      serializeJson(doc, msg);
      ws.textAll(msg);
    }
  }

  if ((WiFi.status() != WL_CONNECTED || ws.count() == 0) && hasValidTelemetry) {
    if (now - lastOfflineLogTime >= OFFLINE_LOG_INTERVAL_MS) {
      lastOfflineLogTime = now;
      appendOfflineRecord(currentTelemetry);
    }
  }

  ws.cleanupClients();
  delay(5);
}
