# MQTT Telemetry Payload Format

The Wokwi ESP32 firmware publishes a JSON snapshot of every Work Room 1
device every 2 seconds on the topic below. The OfficePulse backend
subscribes to that exact topic, validates the payload, and updates the
in-memory device state plus MongoDB persistence.

## Topic

```
office/wokwi/work1/telemetry
```

Configurable on the backend via `MQTT_TOPIC` in `backend/.env`.

## QoS / Retain

- **QoS:** 0 (at-most-once) — telemetry is a heartbeat, missed messages are
  recovered by the next 2-second tick.
- **Retain:** `false` — we never want a stale payload stuck on the broker.

## Payload schema

```jsonc
{
  "source": "wokwi-esp32-work1",       // free-form identifier for the publisher
  "roomId": "work1",                   // MUST equal "work1" — backend rejects others
  "devices": [
    { "deviceId": "work1-fan-1",   "status": "on"  },
    { "deviceId": "work1-fan-2",   "status": "off" },
    { "deviceId": "work1-light-1", "status": "on"  },
    { "deviceId": "work1-light-2", "status": "off" },
    { "deviceId": "work1-light-3", "status": "off" }
  ],
  "timestamp": "2026-07-03T12:00:00.000Z" // ISO-8601 UTC; "uninitialized" if NTP not synced
}
```

### Field rules

| Field      | Type                | Required | Notes                                                      |
|------------|---------------------|----------|------------------------------------------------------------|
| `source`   | string              | optional | Logged for diagnostics only — not used to route messages.  |
| `roomId`   | string              | **yes**  | MUST be `"work1"`. Anything else is logged and dropped.     |
| `devices`  | array&lt;Device&gt; | **yes**  | See below.                                                 |
| `timestamp`| string (ISO-8601)   | optional | Logged only. Backend does not validate the value.           |

`Device` items:

| Field      | Type   | Required | Notes |
|------------|--------|----------|-------|
| `deviceId` | string | **yes**  | MUST start with `work1-` (backend rejects other prefixes). |
| `status`   | string | **yes**  | `"on"` or `"off"`. `true` is also accepted.                |

## Backend handling summary

For each device in `devices` whose status differs from the in-memory
state, the backend:

1. Records the turn-off in `powerCalculatorService` (kWh accumulation).
2. Mutates the device in `officeStateService` (toggles `status`,
   `currentWatt`, `lastChanged`, `onSince`).
3. Persists the new device state + writes a `device_event` to MongoDB.
4. Re-evaluates alerts (after-hours, room-fully-on, high-usage, and the
   60-second DEVICE_OFFLINE watchdog).
5. Emits the following Socket.IO events:
   - `device:changed` (per device)
   - `usage:updated`
   - `alert:new` / `alert:resolved`
   - `connection:status` (when the Wokwi online bit transitions)

## Sample valid payloads

All lights off, fan 1 on:

```json
{
  "source": "wokwi-esp32-work1",
  "roomId": "work1",
  "devices": [
    { "deviceId": "work1-fan-1",   "status": "on"  },
    { "deviceId": "work1-fan-2",   "status": "off" },
    { "deviceId": "work1-light-1", "status": "off" },
    { "deviceId": "work1-light-2", "status": "off" },
    { "deviceId": "work1-light-3", "status": "off" }
  ],
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

## Quick test with mosquitto_pub

```bash
mosquitto_pub -h test.mosquitto.org -p 1883 \
  -t office/wokwi/work1/telemetry \
  -m '{"source":"manual-test","roomId":"work1","devices":[{"deviceId":"work1-fan-1","status":"on"}],"timestamp":"2026-07-03T12:00:00.000Z"}'
```

You should see the backend log `[MQTT] Message received on topic
office/wokwi/work1/telemetry` followed by `[Socket.IO] Broadcasting
device:changed -> work1-fan-1`.