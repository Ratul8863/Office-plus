import { env } from "./env";

const DEV_FALLBACK_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
];

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  for (const raw of String(env.CLIENT_URL).split(",")) {
    const trimmed = raw.trim();
    if (trimmed) origins.add(trimmed);
  }

  if (env.NODE_ENV !== "production") {
    for (const origin of DEV_FALLBACK_ORIGINS) {
      origins.add(origin);
    }
  }

  return Array.from(origins);
}
