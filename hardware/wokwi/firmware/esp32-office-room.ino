/**
 * esp32-office-room.ino
 * ----------------------------------------------------------------------
 * Wokwi ESP32 telemetry publisher for OfficePulse — Work Room 1.
 *
 * Reads 5 wall-mounted switches (2 fans + 3 lights), drives 5 LED
 * indicators to mirror the switch state, and publishes a JSON snapshot
 * of every work1 device over MQTT every 2 seconds.
 *
 * Topic:    office/wokwi/work1/telemetry
 * Payload:  see docs/mqtt-payload-format.md
 *
 * Wiring:   see docs/pin-mapping.md
 * Author:   OfficePulse project
 * License:  MIT
 * ----------------------------------------------------------------------
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ----------------------------------------------------------------------
// Wi-Fi (Wokwi-GUEST is the default open network used inside Wokwi sims)
// ----------------------------------------------------------------------
const char *WIFI_SSID = "Wokwi-GUEST";
const char *WIFI_PASS = ""; // open network

// ----------------------------------------------------------------------
// MQTT broker. Defaults target the public test broker used by Wokwi by
// default; override these constants (or pass them via the Wokwi diagram)
// to point at your own Mosquitto/HiveMQ/EMQX/Cloud broker.
// ----------------------------------------------------------------------
const char *MQTT_HOST  = "test.mosquitto.org";
const int   MQTT_PORT  = 1883;
const char *MQTT_USER  = "";   // blank for anonymous
const char *MQTT_PASS  = "";
const char *MQTT_TOPIC = "office/wokwi/work1/telemetry";

// Publish interval (ms)
const unsigned long PUBLISH_INTERVAL_MS = 2000;

// ----------------------------------------------------------------------
// Pin mapping — see hardware/wokwi/docs/pin-mapping.md
// ----------------------------------------------------------------------
struct Device {
  const char *id;
  uint8_t     switchPin;
  uint8_t     ledPin;
};

// work1 has 2 fans + 3 lights = 5 wall switches, mirrored to 5 LEDs.
const Device DEVICES[5] = {
    {"work1-fan-1",   32, 18},
    {"work1-fan-2",   33, 19},
    {"work1-light-1", 13, 25},
    {"work1-light-2", 12, 26},
    {"work1-light-3", 14, 27},
};

// ----------------------------------------------------------------------
// Globals
// ----------------------------------------------------------------------
WiFiClient    wifiClient;
PubSubClient  mqtt(wifiClient);

unsigned long lastPublishMs = 0;
char          mqttClientId[64];
bool          lastPublishedStates[5] = {false, false, false, false, false};

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

// Switch wired between GPIO and GND: pressed = LOW (on), released = HIGH (off).
inline bool readSwitchOn(uint8_t i) {
  return digitalRead(DEVICES[i].switchPin) == LOW;
}

inline void writeLed(uint8_t i, bool on) {
  digitalWrite(DEVICES[i].ledPin, on ? HIGH : LOW);
}

void connectWifi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("[WIFI] Connected. IP=%s\n", WiFi.localIP().toString().c_str());
}

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  // Backend is publish-only from this client. Callback is registered to
  // keep PubSubClient quiet; left empty intentionally.
  (void)topic;
  (void)payload;
  (void)length;
}

bool connectMqtt() {
  // Suffix with the factory MAC so multiple ESP32s on one broker don't clash.
  uint32_t suffix = (uint32_t)ESP.getEfuseMac();
  snprintf(mqttClientId, sizeof(mqttClientId),
           "officepulse-wokwi-%08X", suffix);

  Serial.printf("[MQTT] Connecting to %s:%d as %s ...\n",
                MQTT_HOST, MQTT_PORT, mqttClientId);

  bool ok = (strlen(MQTT_USER) > 0)
              ? mqtt.connect(mqttClientId, MQTT_USER, MQTT_PASS)
              : mqtt.connect(mqttClientId);

  if (!ok) {
    Serial.printf("[MQTT] Connect failed, rc=%d\n", mqtt.state());
    return false;
  }

  Serial.println("[MQTT] Connected.");
  // Optional echo subscription — useful when running a bridge to the backend.
  mqtt.subscribe(MQTT_TOPIC);
  return true;
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (connectMqtt()) publishTelemetry(); // immediate sync on reconnect
}

// ----------------------------------------------------------------------
// Build the ISO-8601 UTC timestamp using NTP-synced time. Falls back to
// "uninitialized" if NTP hasn't synced yet so the backend still accepts
// the payload and just logs a parse warning for the timestamp field.
// ----------------------------------------------------------------------
String isoTimestamp() {
  time_t now = time(nullptr);
  if (now < 1700000000) return String("uninitialized");
  struct tm *tm = gmtime(&now);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", tm);
  return String(buf);
}

// ----------------------------------------------------------------------
// Build and publish the telemetry payload.
// Schema — see docs/mqtt-payload-format.md
// {
//   "source": "wokwi-esp32-work1",
//   "roomId": "work1",
//   "devices": [
//     { "deviceId": "work1-fan-1",   "status": "on"  },
//     { "deviceId": "work1-fan-2",   "status": "off" },
//     { "deviceId": "work1-light-1", "status": "on"  },
//     { "deviceId": "work1-light-2", "status": "off" },
//     { "deviceId": "work1-light-3", "status": "off" }
//   ],
//   "timestamp": "2026-07-03T12:00:00.000Z"
// }
// ----------------------------------------------------------------------
void publishTelemetry() {
  StaticJsonDocument<512> doc;
  doc["source"]    = "wokwi-esp32-work1";
  doc["roomId"]    = "work1";
  doc["timestamp"] = isoTimestamp();

  JsonArray devs = doc.createNestedArray("devices");
  bool anyChanged = false;

  for (uint8_t i = 0; i < 5; i++) {
    bool on = readSwitchOn(i);
    JsonObject d = devs.createNestedObject();
    d["deviceId"] = DEVICES[i].id;
    d["status"]   = on ? "on" : "off";

    writeLed(i, on);
    if (on != lastPublishedStates[i]) {
      anyChanged      = true;
      lastPublishedStates[i] = on;
    }
  }

  char buf[512];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  if (n == 0 || n >= sizeof(buf)) {
    Serial.println("[MQTT] Serialization failed or buffer too small.");
    return;
  }

  if (!mqtt.publish(MQTT_TOPIC, buf, /*retained*/ false)) {
    Serial.println("[MQTT] publish() returned false (queue full?).");
    return;
  }

  if (anyChanged) {
    Serial.printf("[SWITCH] State changed: %s\n", buf);
  } else {
    Serial.printf("[MQTT] heartbeat: %s\n", buf);
  }
}

// ----------------------------------------------------------------------
// Arduino setup / loop
// ----------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("[BOOT] OfficePulse Wokwi ESP32 — Work Room 1");

  for (uint8_t i = 0; i < 5; i++) {
    pinMode(DEVICES[i].switchPin, INPUT_PULLUP);
    pinMode(DEVICES[i].ledPin,   OUTPUT);
    writeLed(i, false);
  }

  connectWifi();
  configTime(0, 0, "pool.ntp.org"); // best-effort; isoTimestamp() falls back safely
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(1024);
  ensureMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected())              ensureMqtt();
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    publishTelemetry();
  }
}
  for (uint8_t i = 0; i < 5; i++) {
    pinMode(DEVICES[i].switchPin, INPUT_PULLUP);
    pinMode(DEVICES[i].ledPin, OUTPUT);
    writeLed(i, false);
  }

  connectWifi();
  configTime(0, 0, "pool.ntp.org"); // best-effort NTP for ISO timestamps
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(1024);
  ensureMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }
  if (!mqtt.connected()) {
    ensureMqtt();
  }
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    publishTelemetry();
  }
}
