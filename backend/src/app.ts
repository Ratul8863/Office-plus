import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { getAllowedOrigins, isAllowedOrigin } from "./config/cors";
import { getMongoState } from "./db/connectMongo";
import { officeStateService } from "./services/officeState.service";
import stateRoutes from "./routes/state.routes";
import roomRoutes from "./routes/room.routes";
import usageRoutes from "./routes/usage.routes";
import alertRoutes from "./routes/alert.routes";
import deviceRoutes from "./routes/device.routes";
import telemetryRoutes from "./routes/telemetry.routes";
import simulatorRoutes from "./routes/simulator.routes";

const app = express();

const serverStartedAt = Date.now();

const allowedOrigins = new Set(getAllowedOrigins());

// Configure CORS to accept client connection. Echo the request origin so the
// browser sees a matching Access-Control-Allow-Origin header.
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server requests have no Origin header.
      if (isAllowedOrigin(origin)) return cb(null, true);

      const err = new Error(
        `Origin ${origin} not allowed by CORS. Allowed origins: ${
          Array.from(allowedOrigins).join(", ") || "(none configured)"
        }`
      ) as Error & { status?: number };

      err.status = 403;
      return cb(err);
    },
    credentials: true,
  })
);

// JSON body parser
app.use(express.json());

// Health endpoints — unchanged response shape, enriched `data` block.
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      database: getMongoState(),
      mode: env.NODE_ENV,
      uptime: Math.floor((Date.now() - serverStartedAt) / 1000),
      wokwi: {
        online: officeStateService.isWokwiOnline(),
        lastTelemetryAt: officeStateService
          .getLastWokwiTelemetry()
          ?.toISOString() ?? null,
        offlineTimeoutSeconds: env.WOKWI_OFFLINE_TIMEOUT_SECONDS,
      },
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      database: getMongoState(),
      mode: env.NODE_ENV,
      uptime: Math.floor((Date.now() - serverStartedAt) / 1000),
      wokwi: {
        online: officeStateService.isWokwiOnline(),
        lastTelemetryAt: officeStateService
          .getLastWokwiTelemetry()
          ?.toISOString() ?? null,
        offlineTimeoutSeconds: env.WOKWI_OFFLINE_TIMEOUT_SECONDS,
      },
    },
  });
});

// Register routes
app.use("/api/state", stateRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/simulator", simulatorRoutes);

// Centralized error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Centralized Error Handler triggered:", err);
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({
      success: false,
      message,
    });
  }
);

export default app;
