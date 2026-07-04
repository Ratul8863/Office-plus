# Local MQTT smoke-test harness

Tiny in-process tools for end-to-end verifying the backend's MQTT subscriber path
**without** depending on a public broker (e.g. `test.mosquitto.org`) or a real Wokwi
ESP32 board.

## Files

| File | Role |
|------|------|
| `smoke-broker.js` | Pure-Node MQTT 3.1.1 broker on loopback `127.0.0.1:1899`. Implements CONNECT/CONNACK, SUBSCRIBE/SUBACK, PUBLISH (QoS 0, fan-out with `+` and `#` topic wildcards), PINGREQ/PINGRESP, DISCONNECT. |
| `smoke-publish.js` | One-shot publisher that connects to the broker (or any URL pointed to by `MQTT_BROKER_URL`) and emits a payload matching the Wokwi firmware schema: `{source,roomId,devices:[{deviceId,status}],timestamp}`. Accepts `on` or `off` as argv. |
| `smoke-listen.js` | Connects, subscribes, and prints any messages received in a ~5s window. Useful for proving the broker forwards a PUBLISH correctly before involving the backend. |

## End-to-end verify (no Wokwi, no public broker)

From `backend/`:

```powershell
# 1. broker (terminal A) - explicit PORT avoids clobbering backend's PORT=5000
cmd /c "set PORT=1899 && node scripts/smoke-broker.js"

# 2. backend (terminal B)
cmd /c "set PORT=5000 && node dist/server.js"

# 3. publish a synthetic Wokwi frame
node scripts/smoke-publish.js on     # all 5 work1 devices ON
node scripts/smoke-publish.js off    # all 5 work1 devices OFF
```

Expected log line from the backend:

```
[MQTT] Message received on topic office/wokwi/work1/telemetry: {"source":"wokwi-esp32-work1",...}
[Socket.IO] Broadcasting device:changed -> work1-fan-1
[Socket.IO] Broadcasting device:changed -> work1-fan-2
[Socket.IO] Broadcasting device:changed -> work1-light-1
[Socket.IO] Broadcasting device:changed -> work1-light-2
[Socket.IO] Broadcasting device:changed -> work1-light-3
```

Then verify the device states via the REST API:

```powershell
(Invoke-RestMethod -Uri http://localhost:5000/api/state).data |
  Where-Object { $_.deviceId -like 'work1-*' } |
  Format-Table deviceId, status, source
```

Each row should show `source=wokwi` and `status=on/off` matching what you published.

## Notes

- The broker only implements QoS 0. It will reject QoS 1+ traffic gracefully but does
  not retransmit. This matches what the backend's `mqtt` client requests.
- `smoke-publish.js` reads `MQTT_BROKER_URL` / `MQTT_TOPIC` from the environment so
  the same script can be used against Wokwi's broker once you have real credentials.
- The `flags` byte for PUBLISH is encoded in the fixed header's low nibble
  (DUP<<3 | QoS<<1 | RETAIN). The broker never includes a stray flags byte in the
  variable header.
