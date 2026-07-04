import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import { alertService } from "../services/alert.service";
import { env } from "../config/env";

let io: SocketIOServer | null = null;

const parseSocketOrigins = (): string[] | true => {
  // Mirror the HTTP CORS allow-list so the Socket.IO handshake isn't blocked
  // by the browser when the dev server runs on a non-default port.
  const raw = String(env.CLIENT_URL).split(",").map((s) => s.trim()).filter(Boolean);
  const set = new Set<string>(raw);
  if (env.NODE_ENV !== "production") {
    set.add("http://localhost:5173");
    set.add("http://localhost:8080");
    set.add("http://127.0.0.1:5173");
    set.add("http://127.0.0.1:8080");
  }
  return Array.from(set);
};

export const initSocketServer = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: parseSocketOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Immediately emit current office state (required)
    socket.emit("office:state", officeStateService.getDevices());

    // Also immediately emit current usage and connection status for a complete sync
    socket.emit("usage:updated", powerCalculatorService.getUsage());
    
    socket.emit("connection:status", {
      source: "wokwi",
      online: officeStateService.isWokwiOnline(),
      lastSeen: officeStateService.getLastWokwiTelemetry()?.toISOString() || null,
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  // Wire up alert callbacks from AlertService to emit socket events
  alertService.registerCallbacks(
    (alert) => {
      console.log(`[Socket.IO] Broadcasting alert:new -> ${alert.id}`);
      io?.emit("alert:new", alert);
    },
    (alert) => {
      console.log(`[Socket.IO] Broadcasting alert:resolved -> ${alert.id}`);
      io?.emit("alert:resolved", alert);
    }
  );

  return io;
};

export const getIo = (): SocketIOServer | null => io;

export const emitDeviceChanged = (device: any): void => {
  if (io) {
    console.log(`[Socket.IO] Broadcasting device:changed -> ${device.deviceId}`);
    io.emit("device:changed", device);
  }
};

export const emitUsageUpdated = (usage: any): void => {
  if (io) {
    console.log(`[Socket.IO] Broadcasting usage:updated`);
    io.emit("usage:updated", usage);
  }
};

export const emitConnectionStatus = (status: {
  source: string;
  online: boolean;
  lastSeen: string | null;
}): void => {
  if (io) {
    console.log(`[Socket.IO] Broadcasting connection:status -> online: ${status.online}`);
    io.emit("connection:status", status);
  }
};
