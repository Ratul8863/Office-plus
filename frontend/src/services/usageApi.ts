import { apiRequest } from "./apiClient";

export interface UsageData {
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
  estimatedKwhToday: number;
  rooms: {
    roomId: string;
    roomName: string;
    totalWatt: number;
    activeDeviceCount: number;
    activeFans: number;
    activeLights: number;
  }[];
}

export const usageApi = {
  getUsage: () => apiRequest<UsageData>("/api/usage"),
};
