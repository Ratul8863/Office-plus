import { apiRequest } from "./apiClient";

export interface BackendAlert {
  id: string;
  type: "AFTER_HOURS_ON" | "ROOM_FULLY_ON_TOO_LONG" | "HIGH_USAGE" | "DEVICE_OFFLINE";
  status: "active" | "resolved";
  severity: "info" | "warning" | "critical";
  message: string;
  roomId?: string;
  deviceId?: string;
  triggeredAt: string;
  resolvedAt: string | null;
}

export const alertApi = {
  getAlerts: () => apiRequest<BackendAlert[]>("/api/alerts"),
  getActiveAlerts: () => apiRequest<BackendAlert[]>("/api/alerts/active"),
};
