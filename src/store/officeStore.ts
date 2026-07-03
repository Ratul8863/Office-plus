import { create } from "zustand";
import type { Alert, ActivityEvent, Device, RoomId } from "@/types";
import { initialActivity, initialAlerts, initialDevices } from "@/data/mockOfficeState";
import { FAN_WATT, LIGHT_WATT, ROOM_META } from "@/utils/office";

interface State {
  devices: Device[];
  alerts: Alert[];
  activity: ActivityEvent[];
  wokwiConnected: boolean;
  lastUpdated: string;
  toggleDevice: (id: string) => void;
  setDeviceStatus: (id: string, status: "on" | "off") => void;
  randomize: () => void;
  triggerAlert: (type: Alert["type"]) => void;
  simulateWokwiDisconnect: () => void;
  reconnectWokwi: () => void;
  resolveAlert: (id: string) => void;
  reset: () => void;
  tick: () => void;
}

function pushActivity(state: State, ev: Omit<ActivityEvent, "eventId" | "createdAt">): ActivityEvent[] {
  return [
    { ...ev, eventId: crypto.randomUUID(), createdAt: new Date().toISOString() },
    ...state.activity,
  ].slice(0, 40);
}

export const useOfficeStore = create<State>((set) => ({
  devices: initialDevices,
  alerts: initialAlerts,
  activity: initialActivity,
  wokwiConnected: true,
  lastUpdated: initialDevices[0]?.lastChanged ?? "2026-07-03T14:30:00.000Z",

  toggleDevice: (id) =>
    set((s) => {
      const devices: Device[] = s.devices.map((d) => {
        if (d.deviceId !== id) return d;
        const status: "on" | "off" = d.status === "on" ? "off" : "on";
        return {
          ...d,
          status,
          currentWatt: status === "on" ? d.ratedWatt : 0,
          lastChanged: new Date().toISOString(),
          onSince: status === "on" ? new Date().toISOString() : undefined,
        };
      });
      const d = devices.find((x) => x.deviceId === id)!;
      return {
        devices,
        lastUpdated: new Date().toISOString(),
        activity: pushActivity(s, {
          type: "DEVICE_CHANGED",
          message: `${d.roomName} ${d.name} turned ${d.status.toUpperCase()}`,
          roomId: d.roomId,
          deviceId: id,
        }),
      };
    }),

  setDeviceStatus: (id, status) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.deviceId === id
          ? {
              ...d,
              status,
              currentWatt: status === "on" ? d.ratedWatt : 0,
              lastChanged: new Date().toISOString(),
              onSince: status === "on" ? new Date().toISOString() : undefined,
            }
          : d,
      ),
      lastUpdated: new Date().toISOString(),
    })),

  randomize: () =>
    set((s) => {
      const devices = s.devices.map((d) => {
        const on = Math.random() > 0.45;
        return {
          ...d,
          status: on ? "on" : "off",
          currentWatt: on ? d.ratedWatt : 0,
          lastChanged: new Date().toISOString(),
          onSince: on ? new Date().toISOString() : undefined,
        } as Device;
      });
      return {
        devices,
        lastUpdated: new Date().toISOString(),
        activity: pushActivity(s, { type: "SYSTEM", message: "Device states randomized by simulation" }),
      };
    }),

  triggerAlert: (type) =>
    set((s) => {
      const map: Record<Alert["type"], Omit<Alert, "alertId" | "createdAt" | "active">> = {
        AFTER_HOURS_ON: {
          type: "AFTER_HOURS_ON",
          severity: "warning",
          roomId: "work2",
          message: "Work Room 2 still has 2 fans and 3 lights ON after office hours.",
        },
        ROOM_FULLY_ON_TOO_LONG: {
          type: "ROOM_FULLY_ON_TOO_LONG",
          severity: "warning",
          roomId: "drawing",
          message: "Drawing Room has all devices ON for more than 2 hours.",
        },
        HIGH_USAGE: {
          type: "HIGH_USAGE",
          severity: "critical",
          message: "Current usage is above the safe demo threshold.",
        },
        DEVICE_OFFLINE: {
          type: "DEVICE_OFFLINE",
          severity: "critical",
          message: "Wokwi telemetry not received for 60 seconds.",
        },
      };
      const alert: Alert = {
        ...map[type],
        alertId: crypto.randomUUID(),
        active: true,
        createdAt: new Date().toISOString(),
      };
      return {
        alerts: [alert, ...s.alerts],
        activity: pushActivity(s, {
          type: "ALERT_CREATED",
          message: alert.message,
          roomId: alert.roomId,
        }),
      };
    }),

  simulateWokwiDisconnect: () =>
    set((s) => ({
      wokwiConnected: false,
      activity: pushActivity(s, { type: "SYSTEM", message: "Wokwi disconnect simulated" }),
    })),

  reconnectWokwi: () => set({ wokwiConnected: true }),

  resolveAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.alertId === id ? { ...a, active: false, resolvedAt: new Date().toISOString() } : a)),
    })),

  reset: () =>
    set({
      devices: initialDevices,
      alerts: initialAlerts,
      activity: initialActivity,
      wokwiConnected: true,
      lastUpdated: new Date().toISOString(),
    }),

  tick: () => set({ lastUpdated: new Date().toISOString() }),
}));

export function getRoomSummary(devices: Device[], roomId: RoomId) {
  const inRoom = devices.filter((d) => d.roomId === roomId);
  return {
    roomId,
    name: ROOM_META[roomId].name,
    purpose: ROOM_META[roomId].purpose,
    currentWatt: inRoom.reduce((s, d) => s + d.currentWatt, 0),
    activeDevices: inRoom.filter((d) => d.status === "on").length,
    totalDevices: inRoom.length,
  };
}

export { FAN_WATT, LIGHT_WATT };
