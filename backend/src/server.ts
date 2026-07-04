import http from "http";
import app from "./app";
import { env } from "./config/env";
import { initSocketServer, emitConnectionStatus, emitUsageUpdated } from "./socket/socketServer";
import { initMqttClient } from "./mqtt/mqttClient";
import { startSimulator, stopSimulator, stopAutoSimulator } from "./simulator/virtualRoomSimulator";
import { officeStateService, DeviceState } from "./services/officeState.service";
import { alertService } from "./services/alert.service";
import { powerCalculatorService } from "./services/powerCalculator.service";
import { connectMongo, isMongoConnected } from "./db/connectMongo";
import { persistenceService } from "./services/persistence.service";
import { discordService } from "./discord/discord.service";

const server = http.createServer(app);

// 1. Initialize Socket.IO Server
initSocketServer(server);

let usageSnapshotInterval: NodeJS.Timeout | null = null;

/**
 * Build the roomWatts object from a usage payload.
 * Falls back to zeros if the backend doesn't surface a per-room breakdown.
 */
function extractRoomWatts(usage: ReturnType<typeof powerCalculatorService.getUsage>) {
  const rooms = usage.rooms ?? [];
  const findRoom = (id: string) =>
    rooms.find((r: any) => r.roomId === id)?.totalWatt ?? 0;
  return {
    drawing: findRoom("drawing"),
    work1: findRoom("work1"),
    work2: findRoom("work2"),
  };
}

async function bootstrap(): Promise<void> {
  // 2. Connect MongoDB (no-op + warning if not configured)
  await connectMongo();

  // 3. Seed/hydrate devices from MongoDB (when connected)
  if (isMongoConnected()) {
    try {
      await persistenceService.seedDevicesIfEmpty();
      const persisted = await persistenceService.hydrateDevicesFromDb();
      if (persisted && persisted.length > 0) {
        // Sanity check: only override if the count matches the configured device set.
        const expected = officeStateService.getDevices().length;
        if (persisted.length === expected) {
          officeStateService.hydrate(persisted as DeviceState[]);
          console.log(
            `[Startup] In-memory office state hydrated from MongoDB (${persisted.length} devices).`
          );
        } else {
          console.warn(
            `[Startup] MongoDB device count (${persisted.length}) != expected (${expected}); keeping defaults.`
          );
        }
      }
    } catch (err: any) {
      console.error(`[Startup] Mongo seed/hydrate step failed: ${err?.message ?? err}`);
    }
  } else {
    console.log(
      "[Startup] Running with in-memory state (no MongoDB connection)."
    );
  }

  // 4. Start MQTT subscriber if configured (only after state is hydrated so
  //    early telemetry messages overwrite hydrated values consistently).
  initMqttClient();

  // 5. Start embedded Discord bot if configured.
  await discordService.start();

  // 6. Start simulator if enabled
  startSimulator();

  // 7. Initial alert evaluation
  alertService.evaluateAlerts();

  // 8. Wokwi timeout monitor every 5 seconds
  const wokwiTimeoutInterval = setInterval(() => {
    try {
      const statusChanged = officeStateService.checkWokwiTimeout(
        env.WOKWI_OFFLINE_TIMEOUT_SECONDS * 1000
      );
      if (statusChanged) {
        const online = officeStateService.isWokwiOnline();
        const lastSeen = officeStateService.getLastWokwiTelemetry();

        alertService.evaluateAlerts();

        emitConnectionStatus({
          source: "wokwi",
          online,
          lastSeen: lastSeen ? lastSeen.toISOString() : null,
        });

        const usage = powerCalculatorService.getUsage();
        emitUsageUpdated(usage);
      }
    } catch (err: any) {
      console.error("[Monitor] Error in Wokwi timeout check interval:", err.message);
    }
  }, 5000);

  // 9. Usage snapshot interval — every 1 minute (MongoDB only; no-op otherwise).
  usageSnapshotInterval = setInterval(() => {
    if (!persistenceService.isStorageEnabled()) return;
    try {
      const usage = powerCalculatorService.getUsage();
      void persistenceService.saveUsageSnapshot({
        totalWatt: usage.totalWatt,
        activeDeviceCount: usage.activeDeviceCount,
        activeFans: usage.activeFans,
        activeLights: usage.activeLights,
        estimatedKwhToday: usage.estimatedKwhToday,
        roomWatts: extractRoomWatts(usage),
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.error("[Monitor] Error in usage snapshot interval:", err?.message ?? err);
    }
  }, 60 * 1000);

  // Persist one snapshot immediately so dashboards see history right away.
  if (persistenceService.isStorageEnabled()) {
    try {
      const usage = powerCalculatorService.getUsage();
      void persistenceService.saveUsageSnapshot({
        totalWatt: usage.totalWatt,
        activeDeviceCount: usage.activeDeviceCount,
        activeFans: usage.activeFans,
        activeLights: usage.activeLights,
        estimatedKwhToday: usage.estimatedKwhToday,
        roomWatts: extractRoomWatts(usage),
        timestamp: new Date(),
      });
    } catch {
      /* ignore — interval will pick it up next minute */
    }
  }

  // 10. Listen on PORT
  const port = env.PORT;
  server.listen(port, () => {
    console.log(`[Server] OfficePulse Backend listening on http://localhost:${port}`);
    console.log(`[Server] Environment mode: ${env.NODE_ENV}`);
    console.log(`[Server] Database: ${isMongoConnected() ? "connected" : "memory-only"}`);
  });

  // Graceful shutdown
  const handleShutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}. Shutting down backend server...`);
    clearInterval(wokwiTimeoutInterval);
    if (usageSnapshotInterval) clearInterval(usageSnapshotInterval);
    stopSimulator();
    stopAutoSimulator();
    void discordService.stop();
    void persistenceService.shutdown();

    server.close(() => {
      console.log("[Server] Server connection closed. Exit process.");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[Startup] Fatal error during bootstrap:", err);
  process.exit(1);
});

export default server;
