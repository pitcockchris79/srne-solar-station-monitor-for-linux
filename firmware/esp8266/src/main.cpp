/* ==============================================================================
 * SRNE Solar Station Wireless Bridge & Resilient Offline Data Logger
 * Target: ESP8266 (NodeMCU, Wemos D1 Mini, ESP-12E)
 * Features:
 *   - SoftwareSerial Modbus RTU at 9600 baud with DE/RE control
 *   - Hardware Watchdog Timer (30s) with auto-recovery
 *   - WebSocket Server on port 80 (/ws)
 *   - LittleFS Flash Buffer for offline disconnection resilience & auto-sync
 * ============================================================================== */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <ESPAsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <SoftwareSerial.h>

// --- User Configuration ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* HOSTNAME  = "srne-bridge";

// D7 (GPIO 13) = RX from MAX485 RO
// D8 (GPIO 15) = TX to MAX485 DI
// D6 (GPIO 12) = DE/RE pin
#define RS485_RX_PIN   13
#define RS485_TX_PIN   15
#define RS485_DERE_PIN 12
#define MODBUS_BAUD    9600
#define SLAVE_ID       1

#define POLL_INTERVAL_MS        1000
#define OFFLINE_LOG_INTERVAL_MS 5000
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

  currentTelemetry.timestamp     = millis() / 1000;
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
    ESP.wdtFeed();
    delay(10);
  }

  file.close();
  LittleFS.remove(OFFLINE_FILE);
  offlineRecordCount = 0;
  isSyncing = false;
  client->text("{\"type\":\"sync_complete\"}");
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    client->text("{\"type\":\"status\",\"chip\":\"ESP8266\",\"offline_records\":" + String(offlineRecordCount) + "}");
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

  if (MDNS.begin(HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
  }

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
