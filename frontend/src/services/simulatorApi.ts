import { apiRequest } from "./apiClient";

export interface SimulatorStatus {
  simulatorSourceEnabled: boolean;
  autoRunning: boolean;
  intervalMs: number;
  totalTicks: number;
  lastTickAt: string | null;
  lastToggledDeviceId: string | null;
  sourceRooms: string[];
}

export interface SimulatorActionResult {
  started?: boolean;
  stopped?: boolean;
  reason?: string;
  intervalMs?: number;
  autoRunning: boolean;
}

export interface SimulatorTickResult {
  tick: {
    deviceId: string;
    newStatus: "on" | "off";
    changed: boolean;
  } | null;
  autoRunning: boolean;
}

export const simulatorApi = {
  /** Read the live simulator subsystem status. */
  getStatus: () => apiRequest<SimulatorStatus>("/api/simulator/status"),

  /** Start the random auto-tick engine. Optional interval override. */
  start: (intervalMs?: number) =>
    apiRequest<SimulatorActionResult>("/api/simulator/start", {
      method: "POST",
      body: intervalMs ? JSON.stringify({ intervalMs }) : JSON.stringify({}),
    }),

  /** Stop the random auto-tick engine. */
  stop: () =>
    apiRequest<SimulatorActionResult>("/api/simulator/stop", {
      method: "POST",
      body: "{}",
    }),

  /** Fire a single random tick now without starting the engine. */
  toggleRandom: () =>
    apiRequest<SimulatorTickResult>("/api/simulator/toggle-random", {
      method: "POST",
      body: "{}",
    }),
};
