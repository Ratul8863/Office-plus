import { Router } from "express";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { persistenceService } from "../services/persistence.service";

const router = Router();

router.get("/", (_req, res) => {
  const usage = powerCalculatorService.getUsage();
  res.json({
    success: true,
    data: {
      ...usage,
      timestamp: new Date().toISOString(),
    },
  });
});

router.get("/history", async (req, res) => {
  const parsedLimit = Number.parseInt(String(req.query.limit ?? "24"), 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 24;

  const snapshots = await persistenceService.getRecentUsageSnapshots(limit);
  if (snapshots && snapshots.length > 0) {
    res.json({
      success: true,
      data: snapshots
        .slice()
        .reverse()
        .map((snapshot: any) => ({
          timestamp:
            snapshot.timestamp instanceof Date
              ? snapshot.timestamp.toISOString()
              : new Date(snapshot.timestamp).toISOString(),
          totalWatt: snapshot.totalWatt,
          activeDeviceCount: snapshot.activeDeviceCount,
          estimatedKwhToday: snapshot.estimatedKwhToday,
          roomWatts: snapshot.roomWatts,
        })),
    });
    return;
  }

  const usage = powerCalculatorService.getUsage();
  const roomWatts = usage.rooms.reduce(
    (acc, room) => {
      if (room.roomId === "drawing" || room.roomId === "work1" || room.roomId === "work2") {
        acc[room.roomId] = room.totalWatt;
      }
      return acc;
    },
    { drawing: 0, work1: 0, work2: 0 }
  );

  res.json({
    success: true,
    data: [
      {
        timestamp: new Date().toISOString(),
        totalWatt: usage.totalWatt,
        activeDeviceCount: usage.activeDeviceCount,
        estimatedKwhToday: usage.estimatedKwhToday,
        roomWatts,
      },
    ],
  });
});

export default router;
