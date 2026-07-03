import { apiRequest } from "./apiClient";
import type { Device } from "@/types";

export const officeApi = {
  getState: () => apiRequest<Device[]>("/api/state"),
  toggleDevice: (deviceId: string, status?: "on" | "off") =>
    apiRequest<Device>(`/api/devices/${deviceId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
};
