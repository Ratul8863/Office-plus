import { Router } from "express";
import {
  startAutoSimulator,
  stopAutoSimulator,
  isAutoSimulatorRunning,
  runRandomSimulatorTick,
  getSimulatorStatus,
} from "../simulator/virtualRoomSimulator";
import { env } from "../config/env";

const router = Router();

/**
 * GET /api/simulator/status
 * Returns the current state of the simulator subsystem so the frontend can
 * render accurate ON/OFF indicators.
 */
router.get("/status", (_req, res) => {
  res.json({
    success: true,
    data: getSimulatorStatus(),
  });
});

/**
 * POST /api/simulator/start
 * Body: { intervalMs?: number }
 * Starts (or no-ops) the random auto-tick engine.
 */
router.post("/start", (req, res) => {
  const intervalMs =
    typeof req.body?.intervalMs === "number" && req.body.intervalMs > 0
      ? req.body.intervalMs
      : env.SIMULATOR_INTERVAL_MS;

  const result = startAutoSimulator(intervalMs);
  res.json({
    success: true,
    data: {
      ...result,
      autoRunning: isAutoSimulatorRunning(),
    },
  });
});

/**
 * POST /api/simulator/stop
 * Stops the random auto-tick engine if running.
 */
router.post("/stop", (_req, res) => {
  const result = stopAutoSimulator();
  res.json({
    success: true,
    data: {
      ...result,
      autoRunning: isAutoSimulatorRunning(),
    },
  });
});

/**
 * POST /api/simulator/toggle-random
 * Fires a single random tick over the simulator-source devices. Does NOT
 * start or stop the auto engine — this is a one-shot action useful for
 * demos and tests.
 */
router.post("/toggle-random", (_req, res) => {
  const tick = runRandomSimulatorTick();
  res.json({
    success: true,
    data: {
      tick,
      autoRunning: isAutoSimulatorRunning(),
    },
  });
});

export default router;