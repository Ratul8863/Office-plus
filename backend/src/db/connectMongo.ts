import mongoose from "mongoose";
import { env } from "../config/env";

export type MongoState = "connected" | "disconnected" | "not_configured";

let _configured: boolean = false; // Whether MONGODB_URI was set
let _connected: boolean = false;  // Whether the connection is currently live

/**
 * Connect to MongoDB if MONGODB_URI is set. When it's empty/missing the backend
 * runs in memory-only mode — this function logs a warning and returns without
 * throwing, so callers can proceed unchanged.
 *
 * Returns the resolved connection state ("connected" | "disconnected" | "not_configured").
 */
export async function connectMongo(): Promise<MongoState> {
  if (!env.MONGODB_URI) {
    console.warn(
      "[Mongo] MONGODB_URI is not configured. Backend will run in memory-only mode."
    );
    _configured = false;
    _connected = false;
    return "not_configured";
  }

  _configured = true;

  mongoose.connection.on("connected", () => {
    _connected = true;
    console.log("[Mongo] Connection established.");
  });
  mongoose.connection.on("disconnected", () => {
    _connected = false;
    console.log("[Mongo] Connection disconnected.");
  });
  mongoose.connection.on("error", (err) => {
    _connected = false;
    console.error("[Mongo] Connection error:", err?.message ?? err);
  });
  mongoose.connection.on("reconnected", () => {
    _connected = true;
    console.log("[Mongo] Reconnected.");
  });

  try {
    console.log(
      `[Mongo] Connecting to database "${env.MONGODB_DB_NAME}" via MONGODB_URI...`
    );
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 5000,
    });
    _connected = true;
    console.log(`[Mongo] Connected to db "${env.MONGODB_DB_NAME}".`);
    return "connected";
  } catch (err: any) {
    _connected = false;
    console.error(
      `[Mongo] Initial connection failed: ${err?.message ?? err}. Backend will continue in memory-only mode.`
    );
    return "disconnected";
  }
}

export async function disconnectMongo(): Promise<void> {
  if (!_configured) return;
  try {
    await mongoose.disconnect();
  } catch (err: any) {
    console.error(`[Mongo] Error during disconnect: ${err?.message ?? err}`);
  }
}

export function isMongoConfigured(): boolean {
  return _configured;
}

export function isMongoConnected(): boolean {
  return _connected;
}

export function getMongoState(): MongoState {
  if (!_configured) return "not_configured";
  return _connected ? "connected" : "disconnected";
}
