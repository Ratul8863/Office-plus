import axios, { AxiosInstance, AxiosError } from "axios";
import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Typed shapes that mirror the backend responses.
 * These are kept loose on purpose so the bot tolerates extra fields.
 */

export interface DeviceState {
  deviceId: string;
  name: string;
  type: "fan" | "light";
  roomId: string;
  roomName: string;
  ratedWatt: number;
  source: "wokwi" | "simulator";
  status: "on" | "off";
  currentWatt: number;
  lastChanged: string;
  onSince: string | null;
}

export interface StateResponse {
  success: boolean;
  data: DeviceState[];
}

export interface RoomSummary {
  roomId: string;
  roomName: string;
  source: "wokwi" | "simulator";
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
  devices?: DeviceState[];
}

export interface RoomResponse {
  success: boolean;
  data: RoomSummary;
}

export interface RoomsListResponse {
  success: boolean;
  data: RoomSummary[];
}

export interface UsageRoom {
  roomId: string;
  roomName: string;
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
}

export interface UsageResponse {
  success: boolean;
  data: {
    totalWatt: number;
    activeDeviceCount: number;
    activeFans: number;
    activeLights: number;
    estimatedKwhToday: number;
    rooms: UsageRoom[];
  };
}

export interface Alert {
  id: string;
  type: string;
  status: "active" | "resolved";
  severity: "info" | "warning" | "critical";
  message: string;
  roomId?: string;
  deviceId?: string;
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface AlertsResponse {
  success: boolean;
  data: Alert[];
}

/**
 * Custom error raised when the backend is unreachable or returns a failure payload.
 * The router catches this and shows a single friendly message to the user.
 */
export class BackendUnavailableError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BackendUnavailableError";
    this.cause = cause;
  }
}

class BackendClient {
  private http: AxiosInstance;

  constructor(baseURL: string) {
    this.http = axios.create({
      baseURL,
      timeout: 5000,
      headers: { "Content-Type": "application/json" },
    });
  }

  private unwrap<T>(res: { data: { success: boolean; data: T; message?: string } }): T {
    if (!res.data || res.data.success !== true) {
      throw new BackendUnavailableError(
        res.data?.message || "Backend returned an unsuccessful response"
      );
    }
    return res.data.data;
  }

  private handleError(op: string, err: unknown): never {
    if (axios.isAxiosError(err)) {
      const ax = err as AxiosError;
      if (ax.code === "ECONNABORTED") {
        logger.warn(`[backend] ${op} timed out`);
        throw new BackendUnavailableError(
          "The OfficePulse backend took too long to respond.",
          err
        );
      }
      if (!ax.response) {
        logger.warn(`[backend] ${op} network error: ${ax.message}`);
        throw new BackendUnavailableError(
          "The OfficePulse backend is unreachable.",
          err
        );
      }
      logger.warn(`[backend] ${op} returned HTTP ${ax.response.status}`);
      throw new BackendUnavailableError(
        `The OfficePulse backend returned HTTP ${ax.response.status}.`,
        err
      );
    }
    logger.error(`[backend] ${op} unexpected error`, err);
    throw new BackendUnavailableError(
      "An unexpected error occurred while talking to the OfficePulse backend.",
      err
    );
  }

  async getState(): Promise<DeviceState[]> {
    try {
      const res = await this.http.get<StateResponse>("/api/state");
      return this.unwrap<DeviceState[]>(res);
    } catch (err) {
      this.handleError("getState", err);
    }
  }

  async getRoom(roomId: string): Promise<RoomSummary> {
    try {
      const res = await this.http.get<RoomResponse>(`/api/rooms/${encodeURIComponent(roomId)}`);
      return this.unwrap<RoomSummary>(res);
    } catch (err) {
      this.handleError(`getRoom(${roomId})`, err);
    }
  }

  async getUsage(): Promise<UsageResponse["data"]> {
    try {
      const res = await this.http.get<UsageResponse>("/api/usage");
      return this.unwrap<UsageResponse["data"]>(res);
    } catch (err) {
      this.handleError("getUsage", err);
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const res = await this.http.get<AlertsResponse>("/api/alerts/active");
      return this.unwrap<Alert[]>(res);
    } catch (err) {
      this.handleError("getActiveAlerts", err);
    }
  }

  async getAlerts(): Promise<Alert[]> {
    try {
      const res = await this.http.get<AlertsResponse>("/api/alerts");
      return this.unwrap<Alert[]>(res);
    } catch (err) {
      this.handleError("getAlerts", err);
    }
  }
}

let _client: BackendClient | null = null;

export function getBackendClient(): BackendClient {
  if (_client) return _client;
  const env = loadEnv();
  _client = new BackendClient(env.BACKEND_API_URL);
  return _client;
}