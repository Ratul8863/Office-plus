import { Router } from "express";
import { z } from "zod";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { HARDWARE_ROOM_ID, ROOMS } from "../config/device.config";
import { alertService } from "../services/alert.service";
import { emitDeviceChanged, emitUsageUpdated } from "../socket/socketServer";
import { publishHardwareRoomCommand } from "../mqtt/mqttClient";

const router = Router();
const masterStatusSchema = z.object({
  status: z.enum(["on", "off"]),
});

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

router.post("/:roomId/master", async (req, res) => {
  const { roomId } = req.params;
  const room = ROOMS.find((entry) => entry.roomId === roomId);

  if (!room) {
    res.status(404).json({
      success: false,
      message: `Room with ID ${roomId} not found`,
    });
    return;
  }

  const parsed = masterStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: `Invalid room master payload: ${parsed.error.message}`,
    });
    return;
  }

  const { status } = parsed.data;

  try {
    if (roomId === HARDWARE_ROOM_ID) {
      const command = await publishHardwareRoomCommand(roomId, status);
      res.json({
        success: true,
        data: {
          mode: "hardware-queued",
          roomId,
          status,
          topic: command.topic,
          payload: command.payload,
        },
      });
      return;
    }

    const roomDevices = officeStateService
      .getDevices()
      .filter((device) => device.roomId === roomId);

    roomDevices.forEach((device) => {
      if (device.status === status) return;
      if (status === "off") {
        powerCalculatorService.recordDeviceTurnOff(device);
      }
      const { device: updated, changed } = officeStateService.updateDeviceState(
        device.deviceId,
        status
      );
      if (changed) emitDeviceChanged(updated);
    });

    const usage = powerCalculatorService.getUsage();
    alertService.evaluateAlerts();
    emitUsageUpdated(usage);

    res.json({
      success: true,
      data: {
        mode: "direct",
        roomId,
        status,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
