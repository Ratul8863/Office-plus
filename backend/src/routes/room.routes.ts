import { Router } from "express";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { ROOMS } from "../config/device.config";

const router = Router();

router.get("/", (_req, res) => {
  const usage = powerCalculatorService.getUsage();
  const devices = officeStateService.getDevices();

  const data = ROOMS.map((room) => {
    const roomUsage = usage.rooms.find((r) => r.roomId === room.roomId);
    const roomDevices = devices.filter((d) => d.roomId === room.roomId);

    return {
      roomId: room.roomId,
      roomName: room.roomName,
      source: room.source,
      totalWatt: roomUsage?.totalWatt ?? 0,
      activeDeviceCount: roomUsage?.activeDeviceCount ?? 0,
      activeFans: roomUsage?.activeFans ?? 0,
      activeLights: roomUsage?.activeLights ?? 0,
      devices: roomDevices,
    };
  });

  res.json({
    success: true,
    data,
  });
});

router.get("/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = ROOMS.find((r) => r.roomId === roomId);

  if (!room) {
    res.status(404).json({
      success: false,
      message: `Room with ID ${roomId} not found`,
    });
    return;
  }

  const usage = powerCalculatorService.getUsage();
  const devices = officeStateService.getDevices();
  const roomUsage = usage.rooms.find((r) => r.roomId === roomId);
  const roomDevices = devices.filter((d) => d.roomId === roomId);

  res.json({
    success: true,
    data: {
      roomId: room.roomId,
      roomName: room.roomName,
      source: room.source,
      totalWatt: roomUsage?.totalWatt ?? 0,
      activeDeviceCount: roomUsage?.activeDeviceCount ?? 0,
      activeFans: roomUsage?.activeFans ?? 0,
      activeLights: roomUsage?.activeLights ?? 0,
      devices: roomDevices,
    },
  });
});

export default router;
