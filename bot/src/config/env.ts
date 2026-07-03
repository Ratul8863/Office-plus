import dotenv from "dotenv";
import path from "path";

// Load env variables from the bot's .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function readString(key: string, defaultValue?: string): string {
  const v = process.env[key];
  if (v === undefined || v === null || v === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(
      `[env] Missing required environment variable: ${key}`
    );
  }
  return v;
}

function readOptional(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === null || v === "") return undefined;
  return v;
}

function readBool(key: string, defaultValue: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === null || v === "") return defaultValue;
  return v.toLowerCase() === "true" || v === "1";
}

export interface BotEnv {
  DISCORD_TOKEN: string;
  BACKEND_API_URL: string;
  DISCORD_CHANNEL_ID?: string;
  LLM_ENABLED: boolean;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

let cached: BotEnv | null = null;

export function loadEnv(): BotEnv {
  if (cached) return cached;

  const token = (() => {
    try {
      return readString("DISCORD_TOKEN");
    } catch {
      // Re-throw with a friendlier message
      throw new Error(
        "DISCORD_TOKEN is missing. Set it in your .env file. See bot/.env.example."
      );
    }
  })();

  cached = {
    DISCORD_TOKEN: token,
    BACKEND_API_URL: readString("BACKEND_API_URL", "http://localhost:5000"),
    DISCORD_CHANNEL_ID: readOptional("DISCORD_CHANNEL_ID"),
    LLM_ENABLED: readBool("LLM_ENABLED", false),
    GROQ_API_KEY: readOptional("GROQ_API_KEY"),
    OPENAI_API_KEY: readOptional("OPENAI_API_KEY"),
  };

  return cached;
}

export function hasDiscordToken(): boolean {
  const v = process.env.DISCORD_TOKEN;
  return !!v && v.length > 0;
}
