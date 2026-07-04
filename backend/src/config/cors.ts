import { env } from "./env";

const DEV_FALLBACK_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
];

const KNOWN_PRODUCTION_ORIGINS = [
  "https://eco-electricity-zeta.vercel.app",
];

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  for (const raw of String(env.CLIENT_URL).split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const normalized = normalizeOrigin(trimmed);
    origins.add(normalized ?? trimmed);
  }

  for (const origin of KNOWN_PRODUCTION_ORIGINS) {
    origins.add(origin);
  }

  if (env.NODE_ENV !== "production") {
    for (const origin of DEV_FALLBACK_ORIGINS) {
      origins.add(origin);
    }
  }

  return Array.from(origins);
}

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  return new Set(getAllowedOrigins()).has(origin);
}
