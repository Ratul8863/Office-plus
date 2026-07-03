import { io, Socket } from "socket.io-client";
import { useOfficeStore } from "../store/officeStore";
import type { Device, Alert, AlertType } from "@/types";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (socket) return socket;

  console.log(`[Socket] Connecting to Socket.IO server at ${SOCKET_URL}...`);
  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected to Socket.IO backend.");
    useOfficeStore.getState().setSocketConnected(true);
    useOfficeStore.getState().setBackendConnected(true);
  });

  socket.on("disconnect", () => {
    console.log("[Socket] Disconnected from Socket.IO backend.");
    useOfficeStore.getState().setSocketConnected(false);
  });

  socket.on("connect_error", (error) => {
    console.warn("[Socket] Connection error:", error.message);
    useOfficeStore.getState().setSocketConnected(false);
  });

  // Event handlers
  socket.on("office:state", (devices: Device[]) => {
    console.log("[Socket] Received office:state:", devices.length, "devices");
    useOfficeStore.getState().setDevices(devices);
  });

  socket.on("device:changed", (device: Device) => {
    console.log("[Socket] Received device:changed:", device.deviceId, device.status);
    useOfficeStore.getState().updateSingleDevice(device);
  });

  socket.on("usage:updated", (usageData: any) => {
    console.log("[Socket] Received usage:updated");
    useOfficeStore.getState().setUsage(usageData);
  });

  socket.on("alert:new", (alert: any) => {
    console.log("[Socket] Received alert:new:", alert.id, alert.type);
    
    // Map to frontend alert format
    const mappedAlert: Alert = {
      alertId: alert.id,
      type: alert.type as AlertType,
      severity: alert.severity,
      roomId: alert.roomId,
      deviceId: alert.deviceId,
      message: alert.message,
      active: alert.status === "active",
      createdAt: alert.triggeredAt,
      resolvedAt: alert.resolvedAt || undefined,
    };
    
    useOfficeStore.getState().addAlert(mappedAlert);
  });

  socket.on("alert:resolved", (alert: any) => {
    console.log("[Socket] Received alert:resolved:", alert.id);
    useOfficeStore.getState().resolveAlert(alert.id);
  });

  socket.on("connection:status", (status: { source: string; online: boolean; lastSeen: string | null }) => {
    console.log("[Socket] Received connection:status:", status);
    if (status.source === "wokwi") {
      useOfficeStore.getState().setWokwiConnected(status.online);
    }
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    useOfficeStore.getState().setSocketConnected(false);
  }
};
