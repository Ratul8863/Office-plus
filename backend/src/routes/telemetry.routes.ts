import { Router } from "express";
import { z } from "zod";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import { emitDeviceChanged, emitUsageUpdated, emitConnectionStatus } from "../socket/socketServer";
import { HARDWARE_ROOM_ID } from "../config/device.config";

const router = Router();

const telemetrySchema = z.object({
  source: z.string(),
  roomId: z.string(),
  devices: z.array(
    z.object({
      deviceId: z.string(),
      status: z.enum(["on", "off"]),
      ratedWatt: z.number().optional(),
      currentWatt: z.number().optional(),
    })
  ),
});

router.post("/", (req, res) => {
  const parsed = telemetrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: `Invalid telemetry payload: ${parsed.error.message}`,
    });
    return;
  }

  const { roomId, devices } = parsed.data;

  // Enforce updating only the hardware-backed room.
  if (roomId !== HARDWARE_ROOM_ID) {
    res.status(400).json({
      success: false,
      message: `Telemetry updates are restricted to ${HARDWARE_ROOM_ID} (roomId: ${HARDWARE_ROOM_ID}).`,
    });
    return;
  }

  let stateChanged = false;

  // Mark telemetry as received
  const connectionTransitioned = officeStateService.setWokwiTelemetryReceived();
  if (connectionTransitioned) {
    emitConnectionStatus({
      source: "wokwi",
      online: true,
      lastSeen: new Date().toISOString(),
    });
  }

  devices.forEach((d: any) => {
    // Enforce that deviceId is within the configured hardware room.
    if (!d.deviceId.startsWith(`${HARDWARE_ROOM_ID}-`)) {
      console.warn(
        `[Telemetry] Blocked attempt to update device ${d.deviceId} outside ${HARDWARE_ROOM_ID}.`
      );
      return;
    }

    try {
      const currentDevice = officeStateService.getDevice(d.deviceId);
      if (!currentDevice) {
        console.warn(`[Telemetry] Device ${d.deviceId} not found in state store.`);
        return;
      }

      const targetStatus = d.status;

      if (currentDevice.status !== targetStatus) {
        if (targetStatus === "off") {
          powerCalculatorService.recordDeviceTurnOff(currentDevice);
        }

        const { device, changed } = officeStateService.updateDeviceState(d.deviceId, targetStatus);
        if (changed) {
          stateChanged = true;
          emitDeviceChanged(device);
        }
      }
    } catch (e: any) {
      console.error(`[Telemetry] Error updating device ${d.deviceId}:`, e.message);
    }
  });

  if (stateChanged || connectionTransitioned) {
    const usage = powerCalculatorService.getUsage();
    alertService.evaluateAlerts();
    emitUsageUpdated(usage);
  }

  res.json({
    success: true,
    data: {
      message: "Telemetry processed successfully",
    },
  });
});

export default router;
