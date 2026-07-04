import { apiRequest } from "./apiClient";

export interface UsageData {
  timestamp?: string;
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

export interface UsageHistoryPointData {
  timestamp: string;
  totalWatt: number;
  activeDeviceCount: number;
  estimatedKwhToday: number;
  roomWatts: {
    drawing: number;
    work1: number;
    work2: number;
  };
}

export const usageApi = {
  getUsage: () => apiRequest<UsageData>("/api/usage"),
  getHistory: (limit = 24) =>
    apiRequest<UsageHistoryPointData[]>(`/api/usage/history?limit=${limit}`),
};
