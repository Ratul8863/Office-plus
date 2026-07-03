import mqtt from "mqtt";
import { env } from "../config/env";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import { emitDeviceChanged, emitUsageUpdated, emitConnectionStatus } from "../socket/socketServer";

export const initMqttClient = (): void => {
  const brokerUrl = env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.log("[MQTT] MQTT broker URL is not configured. Telemetry subscriber is disabled.");
    return;
  }

  console.log(`[MQTT] Connecting to broker at ${brokerUrl}...`);

  const options: mqtt.IClientOptions = {};
  if (env.MQTT_USERNAME) {
    options.username = env.MQTT_USERNAME;
  }
  if (env.MQTT_PASSWORD) {
    options.password = env.MQTT_PASSWORD;
  }

  try {
    const client = mqtt.connect(brokerUrl, options);

    client.on("connect", () => {
      console.log(`[MQTT] Connected successfully to broker.`);
      client.subscribe(env.MQTT_TOPIC, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to subscribe to topic ${env.MQTT_TOPIC}:`, err);
        } else {
          console.log(`[MQTT] Subscribed to topic: ${env.MQTT_TOPIC}`);
        }
      });
    });

    client.on("message", (topic, message) => {
      try {
        const rawPayload = message.toString();
        console.log(`[MQTT] Message received on topic ${topic}:`, rawPayload);

        const payload = JSON.parse(rawPayload);
        handleMqttTelemetry(payload);
      } catch (err: any) {
        console.error(`[MQTT] Error parsing message on topic ${topic}:`, err.message);
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

const handleMqttTelemetry = (payload: any): void => {
  // Validate that this telemetry payload is for Work Room 1
  if (payload.roomId !== "work1") {
    console.warn(`[MQTT] Telemetry roomId "${payload.roomId}" is ignored (only "work1" is processed).`);
    return;
  }

  const devices = payload.devices;
  if (!Array.isArray(devices)) {
    console.warn("[MQTT] Telemetry payload does not contain a valid devices array.");
    return;
  }

  let stateChanged = false;

  // Mark telemetry as received (sets online status)
  const connectionTransitioned = officeStateService.setWokwiTelemetryReceived();
  if (connectionTransitioned) {
    emitConnectionStatus({
      source: "wokwi",
      online: true,
      lastSeen: new Date().toISOString(),
    });
  }

  devices.forEach((d: any) => {
    if (!d.deviceId || !d.status) return;

    // Enforce that deviceId is within work1
    if (!d.deviceId.startsWith("work1-")) {
      console.warn(`[MQTT] Telemetry attempted to update device ${d.deviceId} in non-work1 room. Blocked.`);
      return;
    }

    try {
      const currentDevice = officeStateService.getDevice(d.deviceId);
      if (!currentDevice) return;

      const newStatus = d.status === "on" || d.status === true ? "on" : "off";

      if (currentDevice.status !== newStatus) {
        // Record turn off before changing status so we calculate kWh accurately
        if (newStatus === "off") {
          powerCalculatorService.recordDeviceTurnOff(currentDevice);
        }

        const { device, changed } = officeStateService.updateDeviceState(d.deviceId, newStatus);
        if (changed) {
          stateChanged = true;
          emitDeviceChanged(device);
        }
      }
    } catch (e: any) {
      console.error(`[MQTT] Error updating device ${d.deviceId}:`, e.message);
    }
  });

  if (stateChanged || connectionTransitioned) {
    const usage = powerCalculatorService.getUsage();
    alertService.evaluateAlerts();
    emitUsageUpdated(usage);
  }
};
