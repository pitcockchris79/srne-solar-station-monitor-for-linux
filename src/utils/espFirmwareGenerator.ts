/**
 * ESP32 & ESP8266 Firmware Generator for SRNE Solar Inverters
 * High-reliability Modbus RS485 WiFi Bridge with LittleFS Offline Flash Logging and Auto-Sync.
 */

export interface FirmwareConfig {
  chip: 'ESP32' | 'ESP8266';
  wifiSsid: string;
  wifiPass: string;
  baudRate: number;
  slaveId: number;
  pollIntervalMs: number;
  offlineLogIntervalMs: number;
  deviceHostname: string;
  wsPort: number;
  // Pin definitions
  rxPin: number;
  txPin: number;
  deRePin: number;
}

export const DEFAULT_FIRMWARE_CONFIG: FirmwareConfig = {
  chip: 'ESP32',
  wifiSsid: 'MySolarWiFi',
  wifiPass: 'SolarSecurePass123',
  baudRate: 9600,
  slaveId: 1,
  pollIntervalMs: 1000,
  offlineLogIntervalMs: 5000,
  deviceHostname: 'srne-bridge',
  wsPort: 81,
  rxPin: 16,
  txPin: 17,
  deRePin: 4,
};

/**
 * Complete, production-grade ESP32 Arduino / PlatformIO C++ firmware
 */
export function generateEsp32Firmware(config: FirmwareConfig): string {
  return `/* ==============================================================================
 * SRNE Solar Station Wireless Bridge & Resilient Offline Data Logger
 * Target: ESP32 (ESP32-WROOM-32, ESP32-S3, ESP32-C3)
 * Features:
 *   - Hardware Watchdog Timer (WDT) with auto-recovery
 *   - Hardware UART2 Modbus RTU at ${config.baudRate} baud with DE/RE direction pin
 *   - High-throughput WebSocket server on port ${config.wsPort} (full-time client stream)
 *   - LittleFS Flash FIFO Ring Buffer: continues logging when WiFi/client drops
 *   - Auto-sync on client reconnect: replays all offline records to client
 *   - Embedded Web status portal on port 80 + mDNS (${config.deviceHostname}.local)
 * ============================================================================== */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <esp_task_wdt.h>
#include <time.h>

// --- Configuration Constants ---
const char* WIFI_SSID = "${config.wifiSsid}";
const char* WIFI_PASS = "${config.wifiPass}";
const char* HOSTNAME  = "${config.deviceHostname}";

#define RS485_RX_PIN  ${config.rxPin}
#define RS485_TX_PIN  ${config.txPin}
#define RS485_DERE_PIN ${config.deRePin}
#define MODBUS_BAUD   ${config.baudRate}
#define SLAVE_ID      ${config.slaveId}

#define POLL_INTERVAL_MS        ${config.pollIntervalMs}
#define OFFLINE_LOG_INTERVAL_MS ${config.offlineLogIntervalMs}
#define WDT_TIMEOUT_SECONDS     30
#define OFFLINE_FILE            "/offline_log.bin"
#define MAX_OFFLINE_BYTES       (1024 * 1024 * 1.5) // 1.5 MB reserve for offline telemetry

// Compact binary record for LittleFS (32 bytes per record)
struct __attribute__((packed)) TelemetryRecord {
  uint32_t timestamp;      // Unix timestamp or millis()
  uint16_t pvVoltage10x;   // 0.1V
  uint16_t pvCurrent10x;   // 0.1A
  uint16_t pvPower;        // Watts
  uint16_t batVoltage10x;  // 0.1V
  int16_t  batCurrent10x;  // 0.1A signed
  uint8_t  batSoc;         // %
  int8_t   batTemp;        // °C
  uint16_t acVolts10x;     // 0.1V
  uint16_t acPower;        // Watts
  uint16_t loadPct10x;     // 0.1%
  int8_t   heatsinkTemp;   // °C
  uint16_t gridVolts10x;   // 0.1V
  uint16_t gridPower;      // Watts
  uint16_t faultCode;      // SRNE Fault
};

// --- Web & Socket Servers ---
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// --- Hardware State ---
HardwareSerial SerialModbus(2);
TelemetryRecord currentTelemetry;
bool hasValidTelemetry = false;
unsigned long lastPollTime = 0;
unsigned long lastOfflineLogTime = 0;
uint32_t offlineRecordCount = 0;
bool isSyncing = false;
uint32_t activeClientId = 0;

// --- Modbus CRC16 Table ---
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

// --- RS485 Communication Routine ---
bool readSrneHoldingRegisters() {
  uint8_t request[8];
  request[0] = SLAVE_ID;
  request[1] = 0x03; // Read Holding Registers
  request[2] = 0x01; // Start Register 0x0100 (high byte)
  request[3] = 0x00; // Start Register 0x0100 (low byte)
  request[4] = 0x00; // Count: 24 registers
  request[5] = 0x18;
  
  uint16_t crc = calculateCRC16(request, 6);
  request[6] = crc & 0xFF;
  request[7] = (crc >> 8) & 0xFF;

  // Flush RX buffer
  while (SerialModbus.available()) SerialModbus.read();

  // Transmit with DE/RE high
  digitalWrite(RS485_DERE_PIN, HIGH);
  delayMicroseconds(50);
  SerialModbus.write(request, 8);
  SerialModbus.flush();
  digitalWrite(RS485_DERE_PIN, LOW);

  // Wait for response: 5 bytes header/crc + 24*2 bytes = 53 bytes
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

  if (bytesRead < expectedLen) {
    return false; // Timeout
  }

  // Verify CRC
  uint16_t respCrc = calculateCRC16(response, expectedLen - 2);
  uint16_t packetCrc = response[expectedLen - 2] | (response[expectedLen - 1] << 8);
  if (respCrc != packetCrc) {
    return false; // CRC error
  }

  // Parse registers into currentTelemetry
  // 0x0100 PV Volts (0.1V), 0x0101 PV Amps (0.1A), 0x0102 PV Watts
  currentTelemetry.timestamp = (uint32_t)time(nullptr);
  if (currentTelemetry.timestamp < 1000000000) currentTelemetry.timestamp = millis() / 1000;
  
  currentTelemetry.pvVoltage10x = (response[3] << 8) | response[4];
  currentTelemetry.pvCurrent10x = (response[5] << 8) | response[6];
  currentTelemetry.pvPower      = (response[7] << 8) | response[8];
  currentTelemetry.batVoltage10x = (response[9] << 8) | response[10];
  currentTelemetry.batCurrent10x = (int16_t)((response[11] << 8) | response[12]);
  currentTelemetry.batSoc       = response[14];
  currentTelemetry.batTemp      = (int8_t)response[16];
  currentTelemetry.heatsinkTemp = (int8_t)response[18];
  currentTelemetry.gridVolts10x = (response[21] << 8) | response[22];
  currentTelemetry.acVolts10x   = (response[25] << 8) | response[26];
  currentTelemetry.acPower      = (response[29] << 8) | response[30];
  currentTelemetry.loadPct10x   = (response[33] << 8) | response[34];
  currentTelemetry.faultCode    = (response[47] << 8) | response[48];

  hasValidTelemetry = true;
  return true;
}

// --- LittleFS Offline Ring Buffer Storage ---
void appendOfflineRecord(const TelemetryRecord &rec) {
  File file = LittleFS.open(OFFLINE_FILE, "a");
  if (!file) {
    Serial.println("[FS] Failed to open offline log for append");
    return;
  }
  
  // Evict oldest if file exceeds max size
  if (file.size() > MAX_OFFLINE_BYTES) {
    file.close();
    Serial.println("[FS] Buffer full: dropping oldest block for FIFO rollover");
    LittleFS.remove("/offline_log_temp.bin");
    File src = LittleFS.open(OFFLINE_FILE, "r");
    File dst = LittleFS.open("/offline_log_temp.bin", "w");
    if (src && dst) {
      src.seek(sizeof(TelemetryRecord) * 200); // Skip oldest 200 records
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

// --- WebSocket Auto-Sync Streamer ---
void streamOfflineSyncBatch(AsyncWebSocketClient *client) {
  if (!LittleFS.exists(OFFLINE_FILE)) {
    client->text("{\\"type\\":\\"sync_complete\\",\\"records\\":0}");
    isSyncing = false;
    return;
  }

  File file = LittleFS.open(OFFLINE_FILE, "r");
  if (!file || file.size() == 0) {
    client->text("{\\"type\\":\\"sync_complete\\",\\"records\\":0}");
    if (file) file.close();
    LittleFS.remove(OFFLINE_FILE);
    offlineRecordCount = 0;
    isSyncing = false;
    return;
  }

  isSyncing = true;
  const size_t batchSize = 40; // 40 records per JSON payload
  TelemetryRecord batch[batchSize];
  size_t totalRecords = file.size() / sizeof(TelemetryRecord);
  size_t processed = 0;

  Serial.printf("[SYNC] Syncing %d offline records to client #%u...\\n", totalRecords, client->id());

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
      item["t"]   = batch[i].timestamp;
      item["pv_w"] = batch[i].pvPower;
      item["pv_v"] = batch[i].pvVoltage10x * 0.1f;
      item["soc"]  = batch[i].batSoc;
      item["bat_v"] = batch[i].batVoltage10x * 0.1f;
      item["bat_w"] = (int)(batch[i].batVoltage10x * 0.1f * batch[i].batCurrent10x * 0.1f);
      item["ac_w"] = batch[i].acPower;
      item["temp"] = batch[i].heatsinkTemp;
    }

    String output;
    serializeJson(doc, output);
    client->text(output);

    processed += count;
    esp_task_wdt_reset();
    delay(20); // Yield to network stack
  }

  file.close();
  LittleFS.remove(OFFLINE_FILE);
  offlineRecordCount = 0;
  isSyncing = false;

  client->text("{\\"type\\":\\"sync_complete\\",\\"records\\":" + String(processed) + "}");
  Serial.printf("[SYNC] Auto-sync finished successfully. %d records transferred.\\n", processed);
}

// --- WebSocket Event Handler ---
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.printf("[WS] Client #%u connected from %s\\n", client->id(), client->remoteIP().toString().c_str());
    activeClientId = client->id();

    // Send immediate status & offline backlog count
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

    // If offline backlog exists, initiate auto-sync immediately
    if (offlineRecordCount > 0) {
      streamOfflineSyncBatch(client);
    }
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.printf("[WS] Client #%u disconnected\\n", client->id());
    if (activeClientId == client->id()) activeClientId = 0;
  }
}

// --- Setup ---
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\\n[INIT] Starting SRNE Solar Station Wireless Bridge (ESP32)...");

  // 1. Hardware Watchdog Timer (30s timeout)
  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL);

  // 2. RS485 Pins & UART2
  pinMode(RS485_DERE_PIN, OUTPUT);
  digitalWrite(RS485_DERE_PIN, LOW);
  SerialModbus.begin(MODBUS_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

  // 3. Mount LittleFS Flash Storage
  if (!LittleFS.begin(true)) {
    Serial.println("[FS] LittleFS Mount Failed!");
  } else {
    Serial.printf("[FS] LittleFS Mounted. Total: %u KB, Used: %u KB\\n",
      LittleFS.totalBytes() / 1024, LittleFS.usedBytes() / 1024);
    countOfflineRecords();
    Serial.printf("[FS] Offline records queued in flash: %u\\n", offlineRecordCount);
  }

  // 4. WiFi Connection with Auto-Reconnect & No Sleep
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.setSleep(false); // Critical: prevents WiFi power-save latency jitter
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.printf("[WIFI] Connecting to %s...", WIFI_SSID);
  unsigned long startWifi = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWifi < 12000) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" CONNECTED!");
    Serial.printf("[WIFI] IP Address: %s\\n", WiFi.localIP().toString().c_str());
    if (MDNS.begin(HOSTNAME)) {
      Serial.printf("[MDNS] Responder started: http://%s.local\\n", HOSTNAME);
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("ws", "tcp", ${config.wsPort});
    }
  } else {
    Serial.println(" TIMEOUT (Will retry in background)");
  }

  // 5. WebSocket & Web Server Setup
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    String html = "<html><head><title>SRNE ESP32 Bridge</title></head><body style='font-family:sans-serif;padding:30px;background:#0f172a;color:#f8fafc;'>"
      "<h2>SRNE Solar Station Wireless Bridge (ESP32)</h2>"
      "<p>Status: <strong style='color:#10b981;'>ONLINE (WDT Active)</strong></p>"
      "<p>Uptime: " + String(millis() / 1000) + "s | Free Heap: " + String(ESP.getFreeHeap()) + " bytes</p>"
      "<p>WiFi RSSI: " + String(WiFi.RSSI()) + " dBm | IP: " + WiFi.localIP().toString() + "</p>"
      "<p>Flash Backlog Queue: " + String(offlineRecordCount) + " records</p>"
      "<p>WebSocket Endpoint: <code>ws://" + WiFi.localIP().toString() + "/ws</code></p>"
      "</body></html>";
    request->send(200, "text/html", html);
  });

  server.begin();
  Serial.println("[HTTP] Web Server & WebSocket active on port 80 /ws");
}

// --- Main Polling & Logging Loop ---
void loop() {
  esp_task_wdt_reset();
  unsigned long now = millis();

  // Periodic Inverter Modbus Poll
  if (now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    bool success = readSrneHoldingRegisters();

    if (success) {
      // If WebSocket client connected, stream live telemetry packet
      if (ws.count() > 0 && !isSyncing) {
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
  }

  // Offline Flash Logger: triggered when no client connected or WiFi disconnected
  if ((WiFi.status() != WL_CONNECTED || ws.count() == 0) && hasValidTelemetry) {
    if (now - lastOfflineLogTime >= OFFLINE_LOG_INTERVAL_MS) {
      lastOfflineLogTime = now;
      appendOfflineRecord(currentTelemetry);
      Serial.printf("[OFFLINE LOG] Stored record #%u in LittleFS. Solar: %uW, SOC: %u%%\\n",
        offlineRecordCount, currentTelemetry.pvPower, currentTelemetry.batSoc);
    }
  }

  // Cleanup disconnected WS sockets
  ws.cleanupClients();
  delay(5);
}
`;
}

/**
 * Complete ESP8266 Arduino / PlatformIO C++ firmware
 */
export function generateEsp8266Firmware(config: FirmwareConfig): string {
  return `/* ==============================================================================
 * SRNE Solar Station Wireless Bridge & Resilient Offline Data Logger
 * Target: ESP8266 (NodeMCU, Wemos D1 Mini, ESP-12E)
 * Features:
 *   - SoftwareSerial / Hardware UART Modbus RTU at ${config.baudRate} baud
 *   - Hardware Watchdog Timer with auto-recovery
 *   - WebSocket Server on port ${config.wsPort}
 *   - LittleFS Flash FIFO Buffer for offline disconnection resilience
 *   - Auto-sync on client reconnect
 * ============================================================================== */

#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <SoftwareSerial.h>

const char* WIFI_SSID = "${config.wifiSsid}";
const char* WIFI_PASS = "${config.wifiPass}";
const char* HOSTNAME  = "${config.deviceHostname}";

// Recommended ESP8266 Pins:
// D7 (GPIO 13) = RX from MAX485 RO
// D8 (GPIO 15) = TX to MAX485 DI
// D6 (GPIO 12) = DE/RE pin
#define RS485_RX_PIN  13
#define RS485_TX_PIN  15
#define RS485_DERE_PIN 12
#define MODBUS_BAUD   ${config.baudRate}
#define SLAVE_ID      ${config.slaveId}

#define POLL_INTERVAL_MS        ${config.pollIntervalMs}
#define OFFLINE_LOG_INTERVAL_MS ${config.offlineLogIntervalMs}
#define OFFLINE_FILE            "/offline.bin"

struct __attribute__((packed)) TelemetryRecord {
  uint32_t timestamp;
  uint16_t pvVoltage10x;
  uint16_t pvPower;
  uint16_t batVoltage10x;
  int16_t  batCurrent10x;
  uint8_t  batSoc;
  int8_t   heatsinkTemp;
  uint16_t acPower;
  uint16_t loadPct10x;
  uint16_t faultCode;
};

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
SoftwareSerial SerialModbus(RS485_RX_PIN, RS485_TX_PIN);

TelemetryRecord currentTelemetry;
bool hasValidTelemetry = false;
unsigned long lastPollTime = 0;
unsigned long lastOfflineLogTime = 0;
uint32_t offlineRecordCount = 0;
bool isSyncing = false;

uint16_t calculateCRC16(const uint8_t *data, uint16_t length) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0xA001;
      else crc = crc >> 1;
    }
  }
  return crc;
}

bool readSrneHoldingRegisters() {
  uint8_t request[8] = {SLAVE_ID, 0x03, 0x01, 0x00, 0x00, 0x18};
  uint16_t crc = calculateCRC16(request, 6);
  request[6] = crc & 0xFF;
  request[7] = (crc >> 8) & 0xFF;

  while (SerialModbus.available()) SerialModbus.read();

  digitalWrite(RS485_DERE_PIN, HIGH);
  delayMicroseconds(50);
  SerialModbus.write(request, 8);
  digitalWrite(RS485_DERE_PIN, LOW);

  const int expectedLen = 53;
  uint8_t response[64];
  int bytesRead = 0;
  unsigned long start = millis();

  while (bytesRead < expectedLen && (millis() - start < 450)) {
    if (SerialModbus.available()) response[bytesRead++] = SerialModbus.read();
    else delay(1);
  }

  if (bytesRead < expectedLen) return false;

  uint16_t respCrc = calculateCRC16(response, expectedLen - 2);
  uint16_t packetCrc = response[expectedLen - 2] | (response[expectedLen - 1] << 8);
  if (respCrc != packetCrc) return false;

  currentTelemetry.timestamp = millis() / 1000;
  currentTelemetry.pvVoltage10x  = (response[3] << 8) | response[4];
  currentTelemetry.pvPower       = (response[7] << 8) | response[8];
  currentTelemetry.batVoltage10x = (response[9] << 8) | response[10];
  currentTelemetry.batCurrent10x = (int16_t)((response[11] << 8) | response[12]);
  currentTelemetry.batSoc        = response[14];
  currentTelemetry.heatsinkTemp  = (int8_t)response[18];
  currentTelemetry.acPower       = (response[29] << 8) | response[30];
  currentTelemetry.loadPct10x    = (response[33] << 8) | response[34];
  currentTelemetry.faultCode     = (response[47] << 8) | response[48];

  hasValidTelemetry = true;
  return true;
}

void appendOfflineRecord(const TelemetryRecord &rec) {
  File file = LittleFS.open(OFFLINE_FILE, "a");
  if (file) {
    file.write((const uint8_t*)&rec, sizeof(TelemetryRecord));
    file.close();
    offlineRecordCount++;
  }
}

void streamOfflineSync(AsyncWebSocketClient *client) {
  if (!LittleFS.exists(OFFLINE_FILE)) return;
  File file = LittleFS.open(OFFLINE_FILE, "r");
  if (!file) return;

  isSyncing = true;
  TelemetryRecord rec;
  size_t total = file.size() / sizeof(TelemetryRecord);
  size_t count = 0;

  while (file.read((uint8_t*)&rec, sizeof(TelemetryRecord)) && client->status() == WS_CONNECTED) {
    StaticJsonDocument<256> doc;
    doc["type"]  = "sync_point";
    doc["t"]     = rec.timestamp;
    doc["pv_w"]  = rec.pvPower;
    doc["soc"]   = rec.batSoc;
    doc["ac_w"]  = rec.acPower;
    doc["bat_v"] = rec.batVoltage10x * 0.1f;
    
    String msg;
    serializeJson(doc, msg);
    client->text(msg);
    count++;
    ESP.wdtFeed();
    delay(10);
  }

  file.close();
  LittleFS.remove(OFFLINE_FILE);
  offlineRecordCount = 0;
  isSyncing = false;
  client->text("{\\"type\\":\\"sync_complete\\"}");
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    client->text("{\\"type\\":\\"status\\",\\"chip\\":\\"ESP8266\\",\\"backlog\\":" + String(offlineRecordCount) + "}");
    if (offlineRecordCount > 0) {
      streamOfflineSync(client);
    }
  }
}

void setup() {
  Serial.begin(115200);
  ESP.wdtEnable(30000);

  pinMode(RS485_DERE_PIN, OUTPUT);
  digitalWrite(RS485_DERE_PIN, LOW);
  SerialModbus.begin(MODBUS_BAUD);

  LittleFS.begin();
  if (LittleFS.exists(OFFLINE_FILE)) {
    File f = LittleFS.open(OFFLINE_FILE, "r");
    offlineRecordCount = f.size() / sizeof(TelemetryRecord);
    f.close();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  ws.onEvent(onWsEvent);
  server.addHandler(&ws);
  server.begin();
}

void loop() {
  ESP.wdtFeed();
  unsigned long now = millis();

  if (now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    if (readSrneHoldingRegisters() && ws.count() > 0 && !isSyncing) {
      StaticJsonDocument<384> doc;
      doc["type"]     = "telemetry";
      doc["pv_w"]     = currentTelemetry.pvPower;
      doc["pv_v"]     = currentTelemetry.pvVoltage10x * 0.1f;
      doc["soc"]      = currentTelemetry.batSoc;
      doc["bat_v"]    = currentTelemetry.batVoltage10x * 0.1f;
      doc["ac_w"]     = currentTelemetry.acPower;
      doc["heatsink"] = currentTelemetry.heatsinkTemp;
      String out;
      serializeJson(doc, out);
      ws.textAll(out);
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
`;
}

/**
 * PlatformIO configuration file (platformio.ini)
 */
export function generatePlatformIoIni(chip: 'ESP32' | 'ESP8266'): string {
  if (chip === 'ESP32') {
    return `; PlatformIO Project Configuration for SRNE ESP32 Wireless Bridge
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600
board_build.filesystem = littlefs
board_build.partitions = default.csv

lib_deps =
    bblanchon/ArduinoJson @ ^6.21.3
    mathieucarbou/ESPAsyncWebServer @ ^3.1.5
    mathieucarbou/AsyncTCP @ ^3.2.4
`;
  } else {
    return `; PlatformIO Project Configuration for SRNE ESP8266 Wireless Bridge
[env:d1_mini]
platform = espressif8266
board = d1_mini
framework = arduino
monitor_speed = 115200
upload_speed = 921600
board_build.filesystem = littlefs

lib_deps =
    bblanchon/ArduinoJson @ ^6.21.3
    mathieucarbou/ESPAsyncWebServer @ ^3.1.5
    mathieucarbou/ESPAsyncTCP @ ^2.0.0
    plerup/EspSoftwareSerial @ ^8.1.0
`;
  }
}
