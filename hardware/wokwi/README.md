# Wokwi — Work Room 1 Hardware Simulator

This folder contains everything needed to run the Work Room 1 device
simulator on a virtual ESP32 inside [Wokwi](https://wokwi.com). The
firmware reads five physical-style pushbuttons and mirrors their state
to five LEDs, then publishes a JSON telemetry snapshot to MQTT every
two seconds. The OfficePulse backend subscribes to that topic and
reflects the changes in the dashboard, Discord bot, and MongoDB in
real time.

## Folder layout

```
hardware/wokwi/
├── README.md                       ← this file
├── diagram.json                    ← import this in wokwi.com to get the wiring
├── firmware/
│   └── esp32-office-room.ino       ← Arduino sketch — paste into the Wokwi editor
└── docs/
    ├── pin-mapping.md              ← GPIO table + diagram.json snippet
    └── mqtt-payload-format.md      ← exact payload schema
```

## Prerequisites

- A free [Wokwi](https://wokwi.com) account (simulator only — no real
  ESP32 required).
- A reachable MQTT broker. The firmware defaults are tuned to the
  public test broker `test.mosquitto.org:1883`, so a fresh Wokwi
  workspace should "just work" for experimentation. Production should
  point at the backend's broker.

## Quick start (3 steps)

1. **Open Wokwi.** Go to <https://wokwi.com> → start a new ESP32
   project → choose **ESP32 DevKit C v4**.

2. **Import the diagram.** Click the `diagram.json` tab (or the gear
   icon → *Import diagram*) and paste the contents of
   `hardware/wokwi/diagram.json`. Save — you should see the ESP32 +
   5 pushbuttons + 5 LEDs wired up exactly per
   `docs/pin-mapping.md`.

3. **Paste the firmware.** Replace the default `sketch.ino` contents
   with the file `hardware/wokwi/firmware/esp32-office-room.ino`.
   Save and click **Start Simulation**.

Watch the Wokwi serial monitor at 115200 baud. Within a couple seconds
you should see:

```
[WiFi] Connected. IP=...  RSSI=...
[NTP] Synced. epoch=...
[MQTT] Connected. clientId=officepulse-wokwi-XXXXXXXX
[MQTT] Heartbeat published (5 devices)
```

## What the firmware does

- Connects to the SSID `Wokwi-GUEST` (Wokwi's open simulator network —
  no password).
- Configures NTP and produces an ISO-8601 UTC `timestamp` for each
  payload.
- Each switch is configured as `INPUT_PULLUP`, so a pressed button
  reads `LOW`.
- Each device has a paired LED that visually mirrors the switch so you
  can see what state is being published.
- Every 2 seconds, the firmware reads the switches, builds a JSON
  payload matching `docs/mqtt-payload-format.md`, and publishes to
  `office/wokwi/work1/telemetry`.
- On MQTT reconnect, the firmware immediately publishes a snapshot so
  the backend picks up the latest state without waiting two seconds.

## Configuring a different broker

The default broker / topic can be overridden by editing the constants
at the top of the firmware:

```cpp
const char* mqttBroker   = "test.mosquitto.org";
const int   mqttPort     = 1883;
const char* mqttTopic    = "office/wokwi/work1/telemetry";
const char* mqttUser     = nullptr;   // or "user"
const char* mqttPass     = nullptr;   // or "pass"
const unsigned long PUBLISH_INTERVAL_MS = 2000;
```

If you point the firmware at a different broker, mirror that broker
URL in `backend/.env`:

```
MQTT_BROKER_URL=mqtt://your-broker:1883
MQTT_TOPIC=office/wokwi/work1/telemetry
```

## Pairing with the backend

1. Start the backend (`npm run dev` inside `backend/`). With no
   `MQTT_BROKER_URL` set, it logs `[MQTT] No MQTT_BROKER_URL configured
   — subscriber disabled.` and silently ignores MQTT — a deliberate
   safety so missing config never crashes the server.
2. Set `MQTT_BROKER_URL` in `backend/.env` to the same broker the
   firmware targets, then restart the backend. It will print
   `[MQTT] Connecting to <broker> ...` followed by `[MQTT] Subscribed
   to <topic>`.
3. Click a button in the Wokwi simulation. Within ~200 ms you should
   see, in the backend console:

   ```
   [MQTT] Message received on topic office/wokwi/work1/telemetry
   [Socket.IO] Broadcasting device:changed -> work1-fan-1
   ```

   and the Work Room 1 panel in the dashboard should light up to match.

## Verification checklist

| Goal                                           | Where to look                                                    |
|------------------------------------------------|------------------------------------------------------------------|
| Wokwi is sending MQTT messages                 | Wokwi serial monitor → `[MQTT] Heartbeat published`              |
| Backend is receiving them                      | Backend console → `[MQTT] Message received on topic …`           |
| Work Room 1 toggles in the dashboard           | <http://localhost:5173/rooms/work1>                              |
| Power usage increments                         | Dashboard summary cards + Discord `!usage work1`                 |
| Discord reflects the change                    | In a Discord channel, run `!room work1`                          |
| Wokwi offline detection                        | Stop the simulation; after 60s a DEVICE_OFFLINE alert appears    |
| Persistence                                    | MongoDB `device_events` collection grows by one row per toggle  |

See `../../backend/src/mqtt/mqttClient.ts` and
`../../backend/src/services/officeState.service.ts` for the receiving
side of the pipeline.
