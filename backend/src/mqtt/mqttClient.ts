import mqtt from "mqtt";
import { z } from "zod";
import { env } from "../config/env";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import {
  emitDeviceChanged,
  emitUsageUpdated,
  emitConnectionStatus,
} from "../socket/socketServer";

// -----------------------------------------------------------------------------
// Zod schemas for the two telemetry payload formats we accept.
//
//   1) Standard (multi-device) — what the Wokwi firmware actually emits today:
//
//        {
//          "source": "wokwi",
//          "roomId": "work1",
//          "timestamp": "2026-07-03T21:05:05Z",
//          "devices": [
//            { "deviceId": "work1-fan-1", "status": "on" },
//            ...
//          ]
//        }
//
//   2) Compact (single-device, snake_case) — useful for `mosquitto_pub` from
//      a CLI when the user wants to flip one device without assembling a full
//      array. The backend normalises it to the standard form before applying.
//
//        { "deviceId": "work1_fan_1", "status": "ON", "roomId": "work1" }
//
// Anything else (extra fields, wrong room, unknown deviceId, malformed JSON)
// is rejected with a single-line warning — the consumer must never crash.
// -----------------------------------------------------------------------------

const deviceUpdateSchema = z.object({
  deviceId: z.string().min(1),
  status: z.union([
    z.literal("on"),
    z.literal("off"),
    z.literal("ON"),
    z.literal("OFF"),
    z.literal(true),
    z.literal(false),
  ]),
});

const multiDevicePayloadSchema = z.object({
  source: z.string().optional(),
  roomId: z.string().min(1),
  timestamp: z.string().optional(),
  devices: z.array(deviceUpdateSchema).min(1),
});

const compactPayloadSchema = z.object({
  deviceId: z.string().min(1),
  status: deviceUpdateSchema.shape.status,
  roomId: z.string().optional(),
  timestamp: z.string().optional(),
});

/**
 * Normalise a compact device id (`work1_fan_1`) to the canonical dash-delimited
 * id (`work1-fan-1`). Only devices of the form `<room>_<type>_<n>` are
 * supported; any other shape is left untouched so the downstream Zod check
 * rejects it with a clear error.
 */
function normalizeCompactDeviceId(rawId: string): string {
  // Fast path: already in canonical form.
  if (rawId.includes("-")) return rawId;
  // Pattern: room-type-N, e.g. work1_fan_1 / drawing_light_3.
  const m = rawId.match(/^([a-z0-9]+)_(fan|light)_(\d+)$/i);
  if (!m) return rawId;
  return `${m[1]}-${m[2].toLowerCase()}-${m[3]}`;
}

/** Map any accepted status shape onto the canonical `"on" | "off"`. */
function normalizeStatus(rawStatus: unknown): "on" | "off" | null {
  if (rawStatus === true) return "on";
  if (rawStatus === false) return "off";
  if (typeof rawStatus !== "string") return null;
  const s = rawStatus.trim().toLowerCase();
  if (s === "on") return "on";
  if (s === "off") return "off";
  return null;
}

/**
 * Convert either accepted payload shape into the standard
 * `{ roomId, devices: [{ deviceId, status }, ...] }` form. Returns
 * `null` if the payload can't be coerced — caller logs and drops it.
 */
function normalizeTelemetry(raw: unknown):
  | { roomId: string; devices: Array<{ deviceId: string; status: "on" | "off" }>; format: "multi" | "compact" }
  | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // ---- Compact single-device payload ---------------------------------------
  if (typeof obj.deviceId === "string" && obj.devices === undefined) {
    const parsed = compactPayloadSchema.safeParse(obj);
    if (!parsed.success) {
      console.warn(
        `[MQTT] Compact payload rejected by Zod: ${parsed.error.message}`
      );
      return null;
    }
    const deviceId = normalizeCompactDeviceId(parsed.data.deviceId);
    const status = normalizeStatus(parsed.data.status);
    if (!status) {
      console.warn(
        `[MQTT] Compact payload has unrecognised status: ${String(
          parsed.data.status
        )}`
      );
      return null;
    }
    return {
      roomId: parsed.data.roomId ?? "work1",
      devices: [{ deviceId, status }],
      format: "compact",
    };
  }

  // ---- Multi-device array payload ------------------------------------------
  if (Array.isArray(obj.devices)) {
    const parsed = multiDevicePayloadSchema.safeParse(obj);
    if (!parsed.success) {
      console.warn(
        `[MQTT] Multi-device payload rejected by Zod: ${parsed.error.message}`
      );
      return null;
    }
    const devices: Array<{ deviceId: string; status: "on" | "off" }> = [];
    for (const d of parsed.data.devices) {
      const status = normalizeStatus(d.status);
      if (!status) continue;
      devices.push({ deviceId: d.deviceId, status });
    }
    if (devices.length === 0) return null;
    return { roomId: parsed.data.roomId, devices, format: "multi" };
  }

  return null;
}

// -----------------------------------------------------------------------------
// MQTT wiring
// -----------------------------------------------------------------------------

export const initMqttClient = (): void => {
  const brokerUrl = env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.log(
      "[MQTT] MQTT_BROKER_URL is not configured. Telemetry subscriber is disabled."
    );
    return;
  }

  console.log(`[MQTT] Connecting to broker at ${brokerUrl}...`);

  const options: mqtt.IClientOptions = {
    clientId: env.MQTT_CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10 * 1000,
  };
  if (env.MQTT_USERNAME) options.username = env.MQTT_USERNAME;
  if (env.MQTT_PASSWORD) options.password = env.MQTT_PASSWORD;

  try {
    const client = mqtt.connect(brokerUrl, options);

    client.on("connect", () => {
      console.log("[MQTT] Connected successfully to broker.");
      client.subscribe(env.MQTT_TOPIC, (err) => {
        if (err) {
          console.error(
            `[MQTT] Failed to subscribe to topic ${env.MQTT_TOPIC}:`,
            err.message
          );
        } else {
          console.log(`[MQTT] Subscribed to topic: ${env.MQTT_TOPIC}`);
        }
      });
    });

    client.on("message", (topic, message) => {
      let rawPayload: string;
      try {
        rawPayload = message.toString();
      } catch (e: any) {
        console.error(`[MQTT] Could not decode message bytes: ${e?.message ?? e}`);
        return;
      }
      console.log(`[MQTT] Message received on topic ${topic}: ${rawPayload}`);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawPayload);
      } catch (e: any) {
        console.warn(
          `[MQTT] Rejected non-JSON payload on ${topic}: ${e?.message ?? e}`
        );
        return;
      }

      let normalized;
      try {
        normalized = normalizeTelemetry(parsedJson);
      } catch (e: any) {
        console.error(`[MQTT] Unexpected error normalising payload: ${e?.message ?? e}`);
        return;
      }
      if (!normalized) {
        console.warn(`[MQTT] Rejected malformed telemetry payload.`);
        return;
      }
      console.log(
        `[MQTT] Normalised ${normalized.format} payload (room=${normalized.roomId}, devices=${normalized.devices.length})`
      );

      try {
        handleMqttTelemetry(normalized.roomId, normalized.devices);
      } catch (e: any) {
        console.error(`[MQTT] Error applying telemetry to state: ${e?.message ?? e}`);
      }
    });

    client.on("error", (err) => {
      console.error("[MQTT] Client connection error:", err.message);
    });

    client.on("close", () => {
      console.log("[MQTT] Connection closed.");
    });
  } catch (err: any) {
    console.error("[MQTT] Fatal error initializing client:", err.message);
  }
};

// -----------------------------------------------------------------------------
// Apply a normalised telemetry payload to the office state.
// -----------------------------------------------------------------------------
function handleMqttTelemetry(
  roomId: string,
  devices: Array<{ deviceId: string; status: "on" | "off" }>
): void {
  // Hard restriction: only Work Room 1 (work1) is fed by MQTT in this build.
  // Drawing Room and Work Room 2 are owned by the simulator and the manual API.
  if (roomId !== "work1") {
    console.warn(
      `[MQTT] Rejected telemetry for roomId "${roomId}" — only "work1" is accepted.`
    );
    return;
  }

  // Mark telemetry as received (sets online status / triggers socket emit).
  const connectionTransitioned = officeStateService.setWokwiTelemetryReceived();
  if (connectionTransitioned) {
    console.log("[MQTT] Wokwi gateway transitioned OFFLINE -> ONLINE");
    emitConnectionStatus({
      source: "wokwi",
      online: true,
      lastSeen: new Date().toISOString(),
    });
  }

  let stateChanged = false;
  let appliedCount = 0;
  let skippedCount = 0;

  for (const d of devices) {
    // Hard restriction: deviceId must be inside Work Room 1.
    if (!d.deviceId.startsWith("work1-")) {
      console.warn(
        `[MQTT] Blocked device update for ${d.deviceId} — outside work1.`
      );
      skippedCount++;
      continue;
    }

    const currentDevice = officeStateService.getDevice(d.deviceId);
    if (!currentDevice) {
      console.warn(`[MQTT] Unknown deviceId ${d.deviceId} — ignored.`);
      skippedCount++;
      continue;
    }

    if (currentDevice.status === d.status) {
      console.log(
        `[MQTT] No-op for ${d.deviceId} (already ${d.status}).`
      );
      continue;
    }

    try {
      // Snapshot the previous status BEFORE flipping it (updateDeviceState
      // mutates the device object in place, so reading currentDevice.status
      // after the call would yield the new value).
      const previousStatus = currentDevice.status;

      // Record turn-off BEFORE flipping status so the kWh accumulator sees
      // the full ON interval.
      if (d.status === "off") {
        powerCalculatorService.recordDeviceTurnOff(currentDevice);
      }

      const { device, changed } = officeStateService.updateDeviceState(
        d.deviceId,
        d.status
      );
      if (changed) {
        stateChanged = true;
        appliedCount++;
        console.log(
          `[MQTT] ${device.deviceId}: ${previousStatus} -> ${device.status} (${device.currentWatt}W) — event persisted, device:changed emitted.`
        );
        emitDeviceChanged(device);
      }
    } catch (e: any) {
      console.error(
        `[MQTT] Error updating device ${d.deviceId}: ${e?.message ?? e}`
      );
      skippedCount++;
    }
  }

  console.log(
    `[MQTT] Payload applied: ${appliedCount} changed, ${skippedCount} skipped/blocked.`
  );

  if (stateChanged || connectionTransitioned) {
    const usage = powerCalculatorService.getUsage();
    alertService.evaluateAlerts();
    emitUsageUpdated(usage);
    console.log("[MQTT] usage:updated emitted; alerts re-evaluated.");
  }
}
