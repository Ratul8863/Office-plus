import express from "express";
import cors from "cors";
import { env } from "./config/env";
import stateRoutes from "./routes/state.routes";
import roomRoutes from "./routes/room.routes";
import usageRoutes from "./routes/usage.routes";
import alertRoutes from "./routes/alert.routes";
import deviceRoutes from "./routes/device.routes";
import telemetryRoutes from "./routes/telemetry.routes";

const app = express();

// Configure CORS to accept client connection
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// JSON body parser
app.use(express.json());

// GET /health and /api/health
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
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
