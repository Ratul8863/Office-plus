import { apiRequest } from "./apiClient";
import type { Device, RoomId } from "@/types";

export interface RoomDetail {
  roomId: RoomId;
  roomName: string;
  source: "wokwi" | "simulator";
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
  devices: Device[];
}

export interface RoomMasterResult {
  mode: "direct" | "hardware-queued";
  roomId: RoomId;
  status: "on" | "off";
  topic?: string;
  payload?: "ON" | "OFF";
}

export const roomApi = {
  getRooms: () => apiRequest<RoomDetail[]>("/api/rooms"),
  getRoom: (roomId: string) => apiRequest<RoomDetail>(`/api/rooms/${roomId}`),
  setMasterState: (roomId: RoomId, status: "on" | "off") =>
    apiRequest<RoomMasterResult>(`/api/rooms/${roomId}/master`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
};
