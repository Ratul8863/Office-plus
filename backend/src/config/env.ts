import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

// Load env variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.string().default("development"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  ENABLE_SIMULATOR: z.preprocess(
    (val: unknown) => val === "true" || val === true || val === "1",
    z.boolean()
  ).default(true),
  /**
   * Toggle the random auto-tick engine for Drawing Room and Work Room 2.
   * Source ("simulator") on devices is independent of this flag — devices
   * can still be controlled manually via the API regardless.
   */
  ENABLE_RANDOM_SIMULATOR: z.preprocess(
    (val: unknown) => val === "true" || val === true || val === "1",
    z.boolean()
  ).default(false),
  SIMULATOR_INTERVAL_MS: z.coerce.number().int().positive().default(8000),
  HIGH_USAGE_THRESHOLD_WATT: z.coerce.number().default(300),
  MONGODB_URI: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MONGODB_DB_NAME: z.string().default("officepulse"),
  MQTT_BROKER_URL: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MQTT_USERNAME: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MQTT_PASSWORD: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MQTT_CLIENT_ID: z.string().default("officepulse-backend"),
  MQTT_TOPIC: z.string().default("office/wokwi/work1/telemetry"),
  /**
   * Number of seconds with no telemetry before Wokwi is considered offline.
   * Triggers the DEVICE_OFFLINE alert and a connection:status socket event.
   */
  WOKWI_OFFLINE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
});

export const env = envSchema.parse(process.env);
