import type { UsageResponse } from "../api/backendClient";

/**
 * Format the office-wide usage report. All numeric values come directly
 * from the backend /api/usage endpoint — the bot never recomputes them.
 */
export function formatUsage(usage: UsageResponse["data"]): string {
  const lines: string[] = [];
  lines.push("⚡ Office usage right now");
  lines.push("");
  lines.push(`Total power: ${usage.totalWatt}W`);
  lines.push(`Active devices: ${usage.activeDeviceCount}`);
  lines.push(`Active fans: ${usage.activeFans}`);
  lines.push(`Active lights: ${usage.activeLights}`);
  lines.push(`Estimated today: ${usage.estimatedKwhToday.toFixed(2)} kWh`);

  if (usage.rooms && usage.rooms.length > 0) {
    lines.push("");
    lines.push("Per-room breakdown:");
    for (const r of usage.rooms) {
      lines.push(
        `  • ${r.roomName}: ${r.totalWatt}W (fans: ${r.activeFans}, lights: ${r.activeLights})`
      );
    }
  }

  return lines.join("\n");
}
