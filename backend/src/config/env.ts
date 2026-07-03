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
  HIGH_USAGE_THRESHOLD_WATT: z.coerce.number().default(300),
  MQTT_BROKER_URL: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MQTT_USERNAME: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MQTT_PASSWORD: z.string().optional().nullable().transform((val: string | null | undefined) => val === "" ? undefined : val),
  MQTT_TOPIC: z.string().default("office/wokwi/work1/telemetry"),
});

export const env = envSchema.parse(process.env);
