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

export const roomApi = {
  getRooms: () => apiRequest<RoomDetail[]>("/api/rooms"),
  getRoom: (roomId: string) => apiRequest<RoomDetail>(`/api/rooms/${roomId}`),
};
