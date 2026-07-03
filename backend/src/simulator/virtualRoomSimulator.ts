import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import { emitDeviceChanged, emitUsageUpdated } from "../socket/socketServer";
import { env } from "../config/env";

let simulatorInterval: NodeJS.Timeout | null = null;

export const startSimulator = (): void => {
  if (!env.ENABLE_SIMULATOR) {
    console.log("[Simulator] Virtual Room Simulator is disabled in configuration.");
    return;
  }

  console.log("[Simulator] Starting Virtual Room Simulator (Drawing Room & Work Room 2) on 8s interval...");

  simulatorInterval = setInterval(() => {
    try {
      const devices = officeStateService.getDevices();
      
      // Filter for drawing and work2 room devices (simulator sources)
      const simulatorDevices = devices.filter(
        (d) => d.roomId === "drawing" || d.roomId === "work2"
      );

      if (simulatorDevices.length === 0) return;

      // Pick a random device
      const randomIndex = Math.floor(Math.random() * simulatorDevices.length);
      const targetDevice = simulatorDevices[randomIndex];
      const newStatus = targetDevice.status === "on" ? "off" : "on";

      console.log(`[Simulator] Toggling ${targetDevice.deviceId} to "${newStatus}"`);

      // Record turn off to accumulate kWh usage
      if (newStatus === "off") {
        powerCalculatorService.recordDeviceTurnOff(targetDevice);
      }

      // Update state
      const { device, changed } = officeStateService.updateDeviceState(
        targetDevice.deviceId,
        newStatus
      );

      if (changed) {
        // Recalculate usage and evaluate alerts
        const usage = powerCalculatorService.getUsage();
        alertService.evaluateAlerts();

        // Broadcast to clients
        emitDeviceChanged(device);
        emitUsageUpdated(usage);
      }
    } catch (error: any) {
      console.error("[Simulator] Error during simulator tick:", error.message);
    }
  }, 8000);
};

export const stopSimulator = (): void => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
    console.log("[Simulator] Virtual Room Simulator stopped.");
  }
};
export default startSimulator;
