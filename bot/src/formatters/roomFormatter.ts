import type { RoomSummary, Alert } from "../api/backendClient.js";

/**
 * Format a single-room report. Numbers come straight from /api/rooms/:id
 * and any alert whose roomId matches.
 */
export function formatRoom(args: { room: RoomSummary; alerts: Alert[] }): string {
  const { room, alerts } = args;
  const lines: string[] = [];

  lines.push(`📍 ${room.roomName} (${room.roomId})`);
  lines.push(`Source: ${room.source === "wokwi" ? "Wokwi" : "Simulator"}`);
  lines.push(`Room total: ${room.totalWatt}W • Active devices: ${room.activeDeviceCount}`);
  lines.push("");

  const devices = room.devices ?? [];
  if (devices.length === 0) {
    lines.push("No devices reported for this room.");
  } else {
    lines.push("Devices:");
    for (const d of devices) {
      const state = d.status === "on" ? `ON • ${d.currentWatt}W` : "OFF";
      lines.push(`  • ${d.name} (${d.type}) — ${state}`);
    }
  }

  const roomAlerts = alerts.filter((a) => a.roomId === room.roomId && a.status === "active");
  if (roomAlerts.length > 0) {
    lines.push("");
    lines.push(`⚠️ Active alerts for this room: ${roomAlerts.length}`);
    for (const a of roomAlerts) {
      lines.push(`  • [${a.severity.toUpperCase()}] ${a.message}`);
    }
  }

  return lines.join("\n");
}
