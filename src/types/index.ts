export type RoomId = "drawing" | "work1" | "work2";

export interface Device {
  deviceId: string;
  name: string;
  type: "fan" | "light";
  roomId: RoomId;
  roomName: string;
  status: "on" | "off";
  ratedWatt: number;
  currentWatt: number;
  source: "wokwi" | "simulator";
  lastChanged: string;
  onSince?: string;
}

export interface Room {
  roomId: RoomId;
  name: string;
  purpose: string;
  currentWatt: number;
  activeDevices: number;
  totalDevices: number;
}

export type AlertType =
  | "AFTER_HOURS_ON"
  | "ROOM_FULLY_ON_TOO_LONG"
  | "HIGH_USAGE"
  | "DEVICE_OFFLINE";

export interface Alert {
  alertId: string;
  type: AlertType;
  severity: "info" | "warning" | "critical";
  roomId?: RoomId;
  deviceId?: string;
  message: string;
  active: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface Usage {
  totalWatt: number;
  estimatedKwhToday: number;
  roomWatts: { drawing: number; work1: number; work2: number };
  activeDeviceCount: number;
}

export interface ActivityEvent {
  eventId: string;
  type: "DEVICE_CHANGED" | "ALERT_CREATED" | "TELEMETRY_RECEIVED" | "SYSTEM";
  message: string;
  roomId?: RoomId;
  deviceId?: string;
  createdAt: string;
}
