import type { Alert } from "../api/backendClient";

const SEVERITY_EMOJI: Record<Alert["severity"], string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

/**
 * Format the active-alert list. When no alerts are active, return a friendly
 * all-clear message. Severity and count are taken directly from the backend.
 */
export function formatAlerts(alerts: Alert[]): string {
  if (!alerts || alerts.length === 0) {
    return "✅ All clear — no active alerts right now. Office is happy.";
  }

  const lines: string[] = [];
  lines.push(`🚨 Active alerts: ${alerts.length}`);
  lines.push("");
  for (const a of alerts) {
    const emoji = SEVERITY_EMOJI[a.severity] ?? "•";
    const ts = formatTimestamp(a.triggeredAt);
    lines.push(`${emoji} [${a.severity.toUpperCase()}] ${a.message}`);
    lines.push(`   Type: ${a.type} • Triggered: ${ts}`);
  }
  return lines.join("\n");
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Discord-friendly UTC stamp; we keep it short and avoid locale surprises.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())} UTC`;
}