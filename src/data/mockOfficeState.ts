import type { Device, RoomId, Alert, ActivityEvent } from "@/types";
import { FAN_WATT, LIGHT_WATT, ROOM_META } from "@/utils/office";

function makeRoomDevices(roomId: RoomId): Device[] {
  const meta = ROOM_META[roomId];
  const now = new Date().toISOString();
  const list: Device[] = [];
  for (let i = 1; i <= 2; i++) {
    list.push({
      deviceId: `${roomId}-fan-${i}`,
      name: `Fan ${i}`,
      type: "fan",
      roomId,
      roomName: meta.name,
      status: "off",
      ratedWatt: FAN_WATT,
      currentWatt: 0,
      source: meta.source,
      lastChanged: now,
    });
  }
  for (let i = 1; i <= 3; i++) {
    list.push({
      deviceId: `${roomId}-light-${i}`,
      name: `Light ${i}`,
      type: "light",
      roomId,
      roomName: meta.name,
      status: "off",
      ratedWatt: LIGHT_WATT,
      currentWatt: 0,
      source: meta.source,
      lastChanged: now,
    });
  }
  return list;
}

export const initialDevices: Device[] = [
  ...makeRoomDevices("drawing"),
  ...makeRoomDevices("work1"),
  ...makeRoomDevices("work2"),
].map((d, idx) => {
  // seed a plausible starting state (about half on)
  const on = [0, 2, 5, 6, 8, 10, 12].includes(idx);
  return on
    ? { ...d, status: "on" as const, currentWatt: d.ratedWatt, onSince: new Date(Date.now() - 1000 * 60 * 45).toISOString() }
    : d;
});

export const initialAlerts: Alert[] = [
  {
    alertId: "a1",
    type: "AFTER_HOURS_ON",
    severity: "warning",
    roomId: "work2",
    message: "Work Room 2 still has 2 fans and 3 lights ON after office hours.",
    active: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    alertId: "a2",
    type: "ROOM_FULLY_ON_TOO_LONG",
    severity: "warning",
    roomId: "drawing",
    message: "Drawing Room has all devices ON for more than 2 hours.",
    active: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
  },
  {
    alertId: "a3",
    type: "HIGH_USAGE",
    severity: "critical",
    message: "Current usage is above the safe demo threshold.",
    active: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
  },
];

export const initialActivity: ActivityEvent[] = [
  {
    eventId: "e1",
    type: "TELEMETRY_RECEIVED",
    message: "Wokwi telemetry received for Work Room 1",
    roomId: "work1",
    createdAt: new Date(Date.now() - 1000 * 20).toISOString(),
  },
  {
    eventId: "e2",
    type: "ALERT_CREATED",
    message: "After-hours alert raised for Work Room 2",
    roomId: "work2",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    eventId: "e3",
    type: "DEVICE_CHANGED",
    message: "Drawing Room Light 2 turned ON",
    roomId: "drawing",
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
];
