import { create } from "zustand";
import type { Alert, ActivityEvent, Device, RoomId, Usage } from "@/types";
import { initialActivity, initialAlerts, initialDevices } from "@/data/mockOfficeState";
import { FAN_WATT, LIGHT_WATT, ROOM_META } from "@/utils/office";
import { officeApi } from "@/services/officeApi";
import { toast } from "sonner";

interface State {
  devices: Device[];
  alerts: Alert[];
  activity: ActivityEvent[];
  wokwiConnected: boolean;
  lastUpdated: string;
  
  // Backend and real-time statuses
  backendConnected: boolean;
  socketConnected: boolean;
  usage: Usage | null;

  // Setters to ingest API and Socket data
  setDevices: (devices: Device[]) => void;
  updateSingleDevice: (device: Device) => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  setUsage: (usage: any) => void;
  setWokwiConnected: (connected: boolean) => void;
  setBackendConnected: (connected: boolean) => void;
  setSocketConnected: (connected: boolean) => void;

  // Handlers
  toggleDevice: (id: string) => Promise<void>;
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

export const useOfficeStore = create<State>((set, get) => ({
  devices: initialDevices,
  alerts: initialAlerts,
  activity: initialActivity,
  wokwiConnected: true,
  lastUpdated: initialDevices[0]?.lastChanged ?? new Date().toISOString(),
  backendConnected: false,
  socketConnected: false,
  usage: null,

  setDevices: (devices) =>
    set({
      devices,
      lastUpdated: new Date().toISOString(),
    }),

  updateSingleDevice: (device) =>
    set((s) => {
      const prevDevice = s.devices.find((d) => d.deviceId === device.deviceId);
      const updatedDevices = s.devices.map((d) =>
        d.deviceId === device.deviceId ? device : d
      );

      let activity = s.activity;
      if (prevDevice && prevDevice.status !== device.status) {
        activity = pushActivity(s, {
          type: "DEVICE_CHANGED",
          message: `${device.roomName} ${device.name} turned ${device.status.toUpperCase()}`,
          roomId: device.roomId,
          deviceId: device.deviceId,
        });
      }

      return {
        devices: updatedDevices,
        lastUpdated: new Date().toISOString(),
        activity,
      };
    }),

  setAlerts: (alerts) => set({ alerts }),

  addAlert: (alert) =>
    set((s) => {
      const exists = s.alerts.some((a) => a.alertId === alert.alertId);
      if (exists) return {};

      return {
        alerts: [alert, ...s.alerts],
        activity: pushActivity(s, {
          type: "ALERT_CREATED",
          message: alert.message,
          roomId: alert.roomId,
        }),
      };
    }),

  setUsage: (usageData) =>
    set((s) => {
      const roomWatts = { drawing: 0, work1: 0, work2: 0 };
      if (usageData && Array.isArray(usageData.rooms)) {
        usageData.rooms.forEach((r: any) => {
          if (r.roomId === "drawing" || r.roomId === "work1" || r.roomId === "work2") {
            roomWatts[r.roomId as RoomId] = r.totalWatt;
          }
        });
      }
      return {
        usage: usageData
          ? {
              totalWatt: usageData.totalWatt,
              estimatedKwhToday: usageData.estimatedKwhToday,
              roomWatts,
              activeDeviceCount: usageData.activeDeviceCount,
            }
          : null,
      };
    }),

  setWokwiConnected: (connected) =>
    set((s) => {
      const changed = s.wokwiConnected !== connected;
      return {
        wokwiConnected: connected,
        activity: changed
          ? pushActivity(s, {
              type: "SYSTEM",
              message: connected ? "Wokwi Gateway connected" : "Wokwi Gateway went offline",
              roomId: "work1",
            })
          : s.activity,
      };
    }),

  setBackendConnected: (connected) => set({ backendConnected: connected }),

  setSocketConnected: (connected) => set({ socketConnected: connected }),

  toggleDevice: async (id) => {
    const state = get();
    const d = state.devices.find((x) => x.deviceId === id);
    if (!d) return;

    if (state.backendConnected) {
      if (d.source === "wokwi" || d.roomId === "work1") {
        toast.error(`Device "${d.name}" in Work Room 1 is managed via Wokwi telemetry and cannot be controlled directly.`);
        return;
      }

      try {
        console.log(`[Store] API toggling device: ${id}`);
        const updatedDevice = await officeApi.toggleDevice(id);
        get().updateSingleDevice(updatedDevice);
      } catch (err: any) {
        console.error("[Store] Failed to toggle device via backend API:", err.message);
        toast.error(`Failed to control device: ${err.message}`);
      }
    } else {
      // Mock toggle fallback (demo mode)
      set((s) => {
        const devices: Device[] = s.devices.map((item) => {
          if (item.deviceId !== id) return item;
          const status: "on" | "off" = item.status === "on" ? "off" : "on";
          return {
            ...item,
            status,
            currentWatt: status === "on" ? item.ratedWatt : 0,
            lastChanged: new Date().toISOString(),
            onSince: status === "on" ? new Date().toISOString() : undefined,
          };
        });
        const target = devices.find((x) => x.deviceId === id)!;
        return {
          devices,
          lastUpdated: new Date().toISOString(),
          activity: pushActivity(s, {
            type: "DEVICE_CHANGED",
            message: `${target.roomName} ${target.name} turned ${target.status.toUpperCase()} (Demo Mode)`,
            roomId: target.roomId,
            deviceId: id,
          }),
        };
      });
    }
  },

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
          : d
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
          message: "Current usage is above the safe operating threshold.",
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
    set((s) => {
      const alert = s.alerts.find((a) => a.alertId === id);
      const updatedAlerts = s.alerts.map((a) =>
        a.alertId === id ? { ...a, active: false, resolvedAt: new Date().toISOString() } : a
      );
      
      let activity = s.activity;
      if (alert && alert.active) {
        activity = pushActivity(s, {
          type: "SYSTEM",
          message: `Alert resolved: ${alert.message}`,
          roomId: alert.roomId,
        });
      }

      return {
        alerts: updatedAlerts,
        activity,
      };
    }),

  reset: () =>
    set({
      devices: initialDevices,
      alerts: initialAlerts,
      activity: initialActivity,
      wokwiConnected: true,
      lastUpdated: new Date().toISOString(),
      backendConnected: false,
      socketConnected: false,
      usage: null,
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
