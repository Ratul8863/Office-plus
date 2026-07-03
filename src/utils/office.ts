import type { Device, RoomId, Usage } from "@/types";

export const FAN_WATT = 60;
export const LIGHT_WATT = 15;

export const ROOM_META: Record<RoomId, { name: string; purpose: string; source: "wokwi" | "simulator" }> = {
  drawing: { name: "Drawing Room", purpose: "Waiting area for guests and clients", source: "simulator" },
  work1: { name: "Work Room 1", purpose: "Primary employee workspace", source: "wokwi" },
  work2: { name: "Work Room 2", purpose: "Secondary employee workspace", source: "simulator" },
};

export function formatWatt(w: number) {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

export function formatKwh(k: number) {
  return `${k.toFixed(2)} kWh`;
}

export function formatTime(iso: string) {
  const date = new Date(iso);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function computeUsage(devices: Device[]): Usage {
  const roomWatts = { drawing: 0, work1: 0, work2: 0 };
  let activeDeviceCount = 0;
  for (const d of devices) {
    roomWatts[d.roomId] += d.currentWatt;
    if (d.status === "on") activeDeviceCount++;
  }
  const totalWatt = roomWatts.drawing + roomWatts.work1 + roomWatts.work2;
  // rough kWh today: assume avg current draw across 8 hours
  const estimatedKwhToday = +(totalWatt * 0.008).toFixed(2);
  return { totalWatt, estimatedKwhToday, roomWatts, activeDeviceCount };
}
