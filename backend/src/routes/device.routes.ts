import { Router } from "express";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import { emitDeviceChanged, emitUsageUpdated } from "../socket/socketServer";
import { publishHardwareDeviceCommand } from "../mqtt/mqttClient";

const router = Router();

router.post("/:deviceId/toggle", async (req, res) => {
  const { deviceId } = req.params;
  const { status } = req.body; // optional: "on" | "off" to force a specific state

  try {
    const currentDevice = officeStateService.getDevice(deviceId);
    if (!currentDevice) {
      res.status(404).json({
        success: false,
        message: `Device with ID ${deviceId} not found`,
      });
      return;
    }

    let targetStatus: "on" | "off";
    if (status === "on" || status === "off") {
      targetStatus = status;
    } else {
      targetStatus = currentDevice.status === "on" ? "off" : "on";
    }

    if (currentDevice.source === "wokwi") {
      const command = await publishHardwareDeviceCommand(deviceId, targetStatus);
      res.json({
        success: true,
        data: {
          mode: "hardware-queued",
          device: currentDevice,
          targetStatus,
          topic: command.topic,
          payload: command.payload,
        },
      });
      return;
    }

    // Record turn off before changing status so we calculate kWh accurately
    if (targetStatus === "off") {
      powerCalculatorService.recordDeviceTurnOff(currentDevice);
    }

    const { device, changed } = officeStateService.updateDeviceState(deviceId, targetStatus);

    if (changed) {
      // Recalculate and evaluate
      const usage = powerCalculatorService.getUsage();
      alertService.evaluateAlerts();

      // Broadcast changes
      emitDeviceChanged(device);
      emitUsageUpdated(usage);
    }

    res.json({
      success: true,
      data: {
        mode: "direct",
        device,
        targetStatus: device.status,
      },
    });
  } catch (error: any) {
    res.status(error?.status ?? 500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
