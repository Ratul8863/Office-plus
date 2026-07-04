import mqtt from "mqtt";
import { z } from "zod";
import { env } from "../config/env";
import { HARDWARE_ROOM_ID } from "../config/device.config";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import {
  emitConnectionStatus,
  emitDeviceChanged,
  emitUsageUpdated,
} from "../socket/socketServer";

const hardwareTopicPrefix = env.MQTT_HARDWARE_TOPIC_PREFIX.replace(/\/+$/, "");

let mqttClient: mqtt.MqttClient | null = null;

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

function normalizeCompactDeviceId(rawId: string): string {
  if (rawId.includes("-")) return rawId;
  const match = rawId.match(/^([a-z0-9]+)_(fan|light)_(\d+)$/i);
  if (!match) return rawId;
  return `${match[1]}-${match[2].toLowerCase()}-${match[3]}`;
}

function normalizeStatus(rawStatus: unknown): "on" | "off" | null {
  if (rawStatus === true) return "on";
  if (rawStatus === false) return "off";
  if (typeof rawStatus !== "string") return null;
  const status = rawStatus.trim().toLowerCase();
  if (status === "on" || status === "1" || status === "true") return "on";
  if (status === "off" || status === "0" || status === "false") return "off";
  return null;
}

function normalizeTelemetry(
  raw: unknown
):
  | {
      roomId: string;
      devices: Array<{ deviceId: string; status: "on" | "off" }>;
      format: "multi" | "compact";
    }
  | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.deviceId === "string" && obj.devices === undefined) {
    const parsed = compactPayloadSchema.safeParse(obj);
    if (!parsed.success) {
      console.warn(`[MQTT] Compact payload rejected by Zod: ${parsed.error.message}`);
      return null;
    }
    const deviceId = normalizeCompactDeviceId(parsed.data.deviceId);
    const status = normalizeStatus(parsed.data.status);
    if (!status) {
      console.warn(
        `[MQTT] Compact payload has unrecognised status: ${String(parsed.data.status)}`
      );
      return null;
    }
    return {
      roomId: parsed.data.roomId ?? HARDWARE_ROOM_ID,
      devices: [{ deviceId, status }],
      format: "compact",
    };
  }

  if (Array.isArray(obj.devices)) {
    const parsed = multiDevicePayloadSchema.safeParse(obj);
    if (!parsed.success) {
      console.warn(`[MQTT] Multi-device payload rejected by Zod: ${parsed.error.message}`);
      return null;
    }
    const devices: Array<{ deviceId: string; status: "on" | "off" }> = [];
    for (const device of parsed.data.devices) {
      const status = normalizeStatus(device.status);
      if (!status) continue;
      devices.push({ deviceId: device.deviceId, status });
    }
    if (devices.length === 0) return null;
    return { roomId: parsed.data.roomId, devices, format: "multi" };
  }

  return null;
}

function canonicalDeviceIdFromShort(roomId: string, shortId: string): string | null {
  const match = shortId.match(/^(light|fan)(\d+)$/i);
  if (!match) return null;
  return `${roomId}-${match[1].toLowerCase()}-${match[2]}`;
}

function shortDeviceIdFromCanonical(deviceId: string): string | null {
  const match = deviceId.match(/^([a-z0-9]+)-(light|fan)-(\d+)$/i);
  if (!match) return null;
  return `${match[2].toLowerCase()}${match[3]}`;
}

function applyDeviceUpdates(
  roomId: string,
  devices: Array<{ deviceId: string; status: "on" | "off" }>,
  sourceLabel: string
): void {
  if (roomId !== HARDWARE_ROOM_ID) {
    console.warn(
      `[MQTT] Rejected ${sourceLabel} update for roomId "${roomId}" — only "${HARDWARE_ROOM_ID}" is accepted.`
    );
    return;
  }

  const connectionTransitioned = officeStateService.setWokwiTelemetryReceived();
  if (connectionTransitioned) {
    emitConnectionStatus({
      source: "wokwi",
      online: true,
      lastSeen: new Date().toISOString(),
    });
  }

  let stateChanged = false;
  let appliedCount = 0;
  let skippedCount = 0;

  for (const nextDevice of devices) {
    if (!nextDevice.deviceId.startsWith(`${roomId}-`)) {
      console.warn(
        `[MQTT] Blocked device update for ${nextDevice.deviceId} — outside ${roomId}.`
      );
      skippedCount += 1;
      continue;
    }

    const currentDevice = officeStateService.getDevice(nextDevice.deviceId);
    if (!currentDevice) {
      console.warn(`[MQTT] Unknown deviceId ${nextDevice.deviceId} — ignored.`);
      skippedCount += 1;
      continue;
    }

    if (currentDevice.status === nextDevice.status) continue;

    try {
      const previousStatus = currentDevice.status;
      if (nextDevice.status === "off") {
        powerCalculatorService.recordDeviceTurnOff(currentDevice);
      }

      const { device, changed } = officeStateService.updateDeviceState(
        nextDevice.deviceId,
        nextDevice.status
      );

      if (changed) {
        stateChanged = true;
        appliedCount += 1;
        console.log(
          `[MQTT] ${sourceLabel}: ${device.deviceId} ${previousStatus} -> ${device.status}`
        );
        emitDeviceChanged(device);
      }
    } catch (error: any) {
      console.error(
        `[MQTT] Error updating device ${nextDevice.deviceId}: ${error?.message ?? error}`
      );
      skippedCount += 1;
    }
  }

  console.log(
    `[MQTT] ${sourceLabel} applied: ${appliedCount} changed, ${skippedCount} skipped.`
  );

  if (stateChanged || connectionTransitioned) {
    const usage = powerCalculatorService.getUsage();
    alertService.evaluateAlerts();
    emitUsageUpdated(usage);
  }
}

function handleHardwareTopicMessage(topic: string, rawPayload: string): boolean {
  if (!topic.startsWith(`${hardwareTopicPrefix}/`)) return false;

  const suffix = topic.slice(hardwareTopicPrefix.length + 1);
  const [target, action] = suffix.split("/");
  if (!target || !action) return true;

  if (action === "set") {
    console.log(`[MQTT] Ignoring command echo on ${topic}`);
    return true;
  }

  if (action !== "state") {
    console.warn(`[MQTT] Ignored unsupported hardware topic ${topic}`);
    return true;
  }

  const status = normalizeStatus(rawPayload);
  if (target === "motion") {
    const connectionTransitioned = officeStateService.setWokwiTelemetryReceived();
    if (connectionTransitioned) {
      emitConnectionStatus({
        source: "wokwi",
        online: true,
        lastSeen: new Date().toISOString(),
      });
    }
    console.log(`[MQTT] Motion update for ${HARDWARE_ROOM_ID}: ${rawPayload}`);
    return true;
  }

  if (!status) {
    console.warn(`[MQTT] Ignored hardware payload with invalid status: ${rawPayload}`);
    return true;
  }

  if (target === "master") {
    const roomDevices = officeStateService
      .getDevices()
      .filter((device) => device.roomId === HARDWARE_ROOM_ID)
      .map((device) => ({ deviceId: device.deviceId, status }));
    applyDeviceUpdates(HARDWARE_ROOM_ID, roomDevices, "hardware master state");
    return true;
  }

  const deviceId = canonicalDeviceIdFromShort(HARDWARE_ROOM_ID, target);
  if (!deviceId) {
    console.warn(`[MQTT] Ignored unknown hardware device key "${target}"`);
    return true;
  }

  applyDeviceUpdates(
    HARDWARE_ROOM_ID,
    [{ deviceId, status }],
    "hardware direct topic"
  );
  return true;
}

function handleJsonTelemetry(topic: string, rawPayload: string): void {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawPayload);
  } catch (error: any) {
    console.warn(`[MQTT] Rejected non-JSON payload on ${topic}: ${error?.message ?? error}`);
    return;
  }

  const normalized = normalizeTelemetry(parsedJson);
  if (!normalized) {
    console.warn("[MQTT] Rejected malformed telemetry payload.");
    return;
  }

  console.log(
    `[MQTT] Normalised ${normalized.format} JSON payload (room=${normalized.roomId}, devices=${normalized.devices.length})`
  );
  applyDeviceUpdates(normalized.roomId, normalized.devices, "legacy telemetry");
}

function requireConnectedClient(): mqtt.MqttClient {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error("MQTT broker is disconnected. Hardware command was not sent.");
  }
  return mqttClient;
}

function publishAsync(topic: string, payload: string): Promise<void> {
  const client = requireConnectedClient();
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { retain: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function publishHardwareDeviceCommand(
  deviceId: string,
  status: "on" | "off"
): Promise<{ topic: string; payload: "ON" | "OFF" }> {
  const shortId = shortDeviceIdFromCanonical(deviceId);
  if (!shortId || !deviceId.startsWith(`${HARDWARE_ROOM_ID}-`)) {
    throw new Error(`Device ${deviceId} is not mapped to the hardware room.`);
  }

  const payload = status === "on" ? "ON" : "OFF";
  const topic = `${hardwareTopicPrefix}/${shortId}/set`;
  await publishAsync(topic, payload);
  console.log(`[MQTT] Published hardware device command -> ${topic} = ${payload}`);
  return { topic, payload };
}

export async function publishHardwareRoomCommand(
  roomId: string,
  status: "on" | "off"
): Promise<{ topic: string; payload: "ON" | "OFF" }> {
  if (roomId !== HARDWARE_ROOM_ID) {
    throw new Error(`Room ${roomId} is not mapped to the hardware controller.`);
  }

  const payload = status === "on" ? "ON" : "OFF";
  const topic = `${hardwareTopicPrefix}/master/set`;
  await publishAsync(topic, payload);
  console.log(`[MQTT] Published hardware room command -> ${topic} = ${payload}`);
  return { topic, payload };
}

export const initMqttClient = (): void => {
  const brokerUrl = env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.log("[MQTT] MQTT_BROKER_URL is not configured. MQTT bridge is disabled.");
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
    mqttClient = mqtt.connect(brokerUrl, options);

    mqttClient.on("connect", () => {
      console.log("[MQTT] Connected successfully to broker.");
      const subscriptions = [env.MQTT_TOPIC, `${hardwareTopicPrefix}/#`];
      mqttClient?.subscribe(subscriptions, (error) => {
        if (error) {
          console.error(
            `[MQTT] Failed to subscribe to MQTT topics ${subscriptions.join(", ")}:`,
            error.message
          );
        } else {
          console.log(`[MQTT] Subscribed to topics: ${subscriptions.join(", ")}`);
        }
      });
    });

    mqttClient.on("message", (topic, message) => {
      const rawPayload = message.toString();
      console.log(`[MQTT] Message received on topic ${topic}: ${rawPayload}`);

      try {
        if (handleHardwareTopicMessage(topic, rawPayload)) return;
        handleJsonTelemetry(topic, rawPayload);
      } catch (error: any) {
        console.error(`[MQTT] Error handling topic ${topic}: ${error?.message ?? error}`);
      }
    });

    mqttClient.on("error", (error) => {
      console.error("[MQTT] Client connection error:", error.message);
    });

    mqttClient.on("close", () => {
      console.log("[MQTT] Connection closed.");
    });
  } catch (error: any) {
    console.error("[MQTT] Fatal error initializing client:", error.message);
  }
};
