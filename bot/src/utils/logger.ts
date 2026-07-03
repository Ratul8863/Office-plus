// Lightweight logger that never prints sensitive secrets (like DISCORD_TOKEN).
// We strip anything that looks like a token before forwarding to console.

const TOKEN_REGEX = /([A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/g;

function sanitize(input: unknown): unknown {
  if (typeof input === "string") {
    return input.replace(TOKEN_REGEX, "[REDACTED]");
  }
  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message.replace(TOKEN_REGEX, "[REDACTED]"),
      stack: input.stack?.replace(TOKEN_REGEX, "[REDACTED]"),
    };
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (lower.includes("token") || lower.includes("secret") || lower.includes("password")) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return input;
}

function fmt(level: string, args: unknown[]): unknown[] {
  return [`[bot][${level}]`, ...args.map(sanitize)];
}

export const logger = {
  info: (...args: unknown[]) => console.log(...fmt("info", args)),
  warn: (...args: unknown[]) => console.warn(...fmt("warn", args)),
  error: (...args: unknown[]) => console.error(...fmt("error", args)),
  debug: (...args: unknown[]) => console.debug(...fmt("debug", args)),
};
