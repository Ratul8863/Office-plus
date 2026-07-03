import http from "http";
import app from "./app";
import { env } from "./config/env";
import { initSocketServer, emitConnectionStatus, emitUsageUpdated } from "./socket/socketServer";
import { initMqttClient } from "./mqtt/mqttClient";
import { startSimulator, stopSimulator } from "./simulator/virtualRoomSimulator";
import { officeStateService } from "./services/officeState.service";
import { alertService } from "./services/alert.service";
import { powerCalculatorService } from "./services/powerCalculator.service";

const server = http.createServer(app);

// 1. Initialize Socket.IO Server
initSocketServer(server);

// 2. Initialize MQTT Client (will only connect if configured)
initMqttClient();

// 3. Start Virtual Room Simulator (will only run if enabled)
startSimulator();

// 4. Initial Alert Evaluation
alertService.evaluateAlerts();

// 5. Periodic Wokwi timeout monitor (every 5 seconds)
const wokwiTimeoutInterval = setInterval(() => {
  try {
    const statusChanged = officeStateService.checkWokwiTimeout();
    if (statusChanged) {
      const online = officeStateService.isWokwiOnline();
      const lastSeen = officeStateService.getLastWokwiTelemetry();

      // Run alert evaluation to trigger or resolve DEVICE_OFFLINE alert
      alertService.evaluateAlerts();

      // Emit new connection status to clients
      emitConnectionStatus({
        source: "wokwi",
        online,
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
      });

      // Broadcast the recalculation usage updates
      const usage = powerCalculatorService.getUsage();
      emitUsageUpdated(usage);
    }
  } catch (err: any) {
    console.error("[Monitor] Error in Wokwi timeout check interval:", err.message);
  }
}, 5000);

const port = env.PORT;

server.listen(port, () => {
  console.log(`[Server] OfficePulse Backend listening on http://localhost:${port}`);
  console.log(`[Server] Environment mode: ${env.NODE_ENV}`);
});

// Handle graceful shutdown
const handleShutdown = (signal: string) => {
  console.log(`[Server] Received ${signal}. Shutting down backend server...`);
  
  clearInterval(wokwiTimeoutInterval);
  stopSimulator();

  server.close(() => {
    console.log("[Server] Server connection closed. Exit process.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
export default server;
