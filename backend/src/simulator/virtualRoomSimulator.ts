import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import { emitDeviceChanged, emitUsageUpdated } from "../socket/socketServer";
import { env } from "../config/env";

/**
 * Simulated-device source is decoupled from the random tick engine.
 *
 * - The device `source: "simulator"` label is set statically by
 *   `device.config.ts` for Work Room 1 and Work Room 2 rooms. It is
 *   unaffected by these flags.
 * - `ENABLE_SIMULATOR` (env) marks the simulator subsystem as the source
 *   of truth for those rooms. Today it does not change runtime behaviour
 *   beyond enabling the simulator subsystem on boot.
 * - `ENABLE_RANDOM_SIMULATOR` (env) controls whether the backend ticks
 *   random toggles automatically. It can also be flipped at runtime via
 *   the `/api/simulator/{start,stop}` endpoints.
 * - Manual `POST /api/devices/:deviceId/toggle` always works regardless
 *   of either flag — only hardware-backed devices are reserved for MQTT.
 */

let autoInterval: NodeJS.Timeout | null = null;
let lastTick: Date | null = null;
let lastToggledDeviceId: string | null = null;
let totalTicks = 0;

function isSimulatorSubsystemEnabled(): boolean {
  // The simulator subsystem is only meaningful when the simulator source
  // is enabled at all. Without this, `startAutoSimulator` would have
  // nothing to tick.
  return Boolean(env.ENABLE_SIMULATOR);
}

/**
 * Run a single random tick over the simulator-source devices and emit
 * the resulting socket events. Returns the device that was toggled on
 * success, or null when nothing changed.
 */
export function runRandomSimulatorTick(): {
  deviceId: string;
  newStatus: "on" | "off";
  changed: boolean;
} | null {
  try {
    const devices = officeStateService.getDevices();

    const simulatorDevices = devices.filter((d) => d.source === "simulator");
    if (simulatorDevices.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * simulatorDevices.length);
    const targetDevice = simulatorDevices[randomIndex];
    const newStatus = targetDevice.status === "on" ? "off" : "on";

    if (newStatus === "off") {
      powerCalculatorService.recordDeviceTurnOff(targetDevice);
    }

    const { device, changed } = officeStateService.updateDeviceState(
      targetDevice.deviceId,
      newStatus
    );

    if (changed) {
      const usage = powerCalculatorService.getUsage();
      alertService.evaluateAlerts();
      emitDeviceChanged(device);
      emitUsageUpdated(usage);
    }

    totalTicks += 1;
    lastTick = new Date();
    lastToggledDeviceId = targetDevice.deviceId;

    return { deviceId: targetDevice.deviceId, newStatus, changed };
  } catch (error: any) {
    console.error("[Simulator] Error during simulator tick:", error?.message ?? error);
    return null;
  }
}

export function isAutoSimulatorRunning(): boolean {
  return autoInterval !== null;
}

export interface SimulatorStatus {
  simulatorSourceEnabled: boolean;
  autoRunning: boolean;
  intervalMs: number;
  totalTicks: number;
  lastTickAt: string | null;
  lastToggledDeviceId: string | null;
  sourceRooms: string[];
}

export function getSimulatorStatus(): SimulatorStatus {
  return {
    simulatorSourceEnabled: Boolean(env.ENABLE_SIMULATOR),
    autoRunning: isAutoSimulatorRunning(),
    intervalMs: env.SIMULATOR_INTERVAL_MS,
    totalTicks,
    lastTickAt: lastTick ? lastTick.toISOString() : null,
    lastToggledDeviceId,
    sourceRooms: ["work1", "work2"],
  };
}

/**
 * Start the random auto-tick engine. Idempotent — calling it twice does
 * not create a parallel interval.
 */
export function startAutoSimulator(intervalMs?: number): {
  started: boolean;
  reason?: string;
  intervalMs: number;
} {
  if (!isSimulatorSubsystemEnabled()) {
    console.warn(
      "[Simulator] ENABLE_SIMULATOR is false. Auto simulator will not run."
    );
    return {
      started: false,
      reason: "ENABLE_SIMULATOR is disabled in configuration.",
      intervalMs: env.SIMULATOR_INTERVAL_MS,
    };
  }

  if (autoInterval) {
    return { started: true, intervalMs: intervalMs ?? env.SIMULATOR_INTERVAL_MS };
  }

  const ms = intervalMs ?? env.SIMULATOR_INTERVAL_MS;
  console.log(
    `[Simulator] Starting auto-tick engine (Work Room 1 & Work Room 2) every ${ms}ms.`
  );
  autoInterval = setInterval(() => {
    runRandomSimulatorTick();
  }, ms);
  return { started: true, intervalMs: ms };
}

/**
 * Stop the random auto-tick engine. Idempotent.
 */
export function stopAutoSimulator(): { stopped: boolean } {
  if (!autoInterval) return { stopped: false };
  clearInterval(autoInterval);
  autoInterval = null;
  console.log("[Simulator] Auto-tick engine stopped.");
  return { stopped: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Backwards-compatible wrappers. Prefer the explicit `startAutoSimulator` /
// `stopAutoSimulator` for new code.
// ──────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Use `startAutoSimulator` directly.
 */
export const startSimulator = (): void => {
  if (!env.ENABLE_SIMULATOR) {
    console.log("[Simulator] Simulator subsystem is disabled in configuration.");
    return;
  }
  if (!env.ENABLE_RANDOM_SIMULATOR) {
    console.log(
      "[Simulator] Virtual Room Simulator is enabled but random ticking is off. Manual API control remains available; use POST /api/simulator/start to enable auto ticking."
    );
    return;
  }
  startAutoSimulator();
};

/**
 * @deprecated Use `stopAutoSimulator` directly.
 */
export const stopSimulator = (): void => {
  stopAutoSimulator();
};

export default startAutoSimulator;
