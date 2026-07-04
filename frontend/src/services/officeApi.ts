import { apiRequest } from "./apiClient";
import type { Device } from "@/types";

export interface DeviceToggleResult {
  mode: "direct" | "hardware-queued";
  device: Device;
  targetStatus: "on" | "off";
  topic?: string;
  payload?: "ON" | "OFF";
}

export const officeApi = {
  getState: () => apiRequest<Device[]>("/api/state"),
  toggleDevice: (deviceId: string, status?: "on" | "off") =>
    apiRequest<DeviceToggleResult>(`/api/devices/${deviceId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
};
