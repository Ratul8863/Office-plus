import type { DeviceState } from "../services/officeState.service";
import type { Alert } from "../services/alert.service";
import { ROOM_ALIASES } from "./roomName";

export interface RoomSummary {
  roomId: string;
  roomName: string;
  source: "wokwi" | "simulator";
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
  devices?: DeviceState[];
}

export interface UsageSummary {
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
  estimatedKwhToday: number;
  rooms: Array<{
    roomId: string;
    roomName: string;
    totalWatt: number;
    activeDeviceCount: number;
    activeFans: number;
    activeLights: number;
  }>;
}

const SEVERITY_EMOJI: Record<Alert["severity"], string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

export function formatHelp(prefix: string, acceptedRooms: Record<string, string[]>): string {
  const roomHelp = Object.keys(acceptedRooms)
    .map((id) => `  • ${id} (${acceptedRooms[id].join(", ")})`)
    .join("\n");

  return [
    "🤖 OfficePulse Bot — commands",
    "",
    "All data is read live from the OfficePulse backend.",
    "",
    `${prefix}status`,
    "  Live office snapshot: room-by-room fan/light counts, total watt,",
    "  today's estimated kWh, and active alert count.",
    "",
    `${prefix}room <name>`,
    "  Detailed view of one room. Accepted names:",
    roomHelp,
    "",
    `${prefix}usage`,
    "  Office-wide watt, kWh-today, active fans/lights, and per-room watt totals.",
    "",
    `${prefix}alerts`,
    "  List all active alerts (severity, message, timestamp).",
    "  If there are none, you'll get an all-clear message.",
    "",
    `${prefix}help`,
    "  Show this help message.",
  ].join("\n");
}

export function formatStatus(args: {
  devices: DeviceState[];
  usage: UsageSummary;
  alerts: Alert[];
}): string {
  const { devices, usage, alerts } = args;
  const roomLines: string[] = [];

  for (const room of ROOM_ALIASES) {
    const roomDevices = devices.filter((d) => d.roomId === room.roomId);
    const fans = roomDevices.filter((d) => d.type === "fan" && d.status === "on").length;
    const lights = roomDevices.filter((d) => d.type === "light" && d.status === "on").length;
    const anyOn = fans + lights > 0;
    const fanText = `${fans} fan${fans === 1 ? "" : "s"} ON`;
    const lightText = `${lights} light${lights === 1 ? "" : "s"} ON`;
    roomLines.push(
      anyOn ? `${room.roomName}: ${fanText}, ${lightText}` : `${room.roomName}: all devices OFF`
    );
  }

  return [
    "Boss, here's the live office snapshot 👀",
    "",
    ...roomLines,
    "",
    `Total power right now: ${usage.totalWatt}W`,
    `Today's estimated usage: ${usage.estimatedKwhToday.toFixed(2)} kWh`,
    `Active alerts: ${alerts.length}`,
  ].join("\n");
}

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
    for (const device of devices) {
      const state = device.status === "on" ? `ON • ${device.currentWatt}W` : "OFF";
      lines.push(`  • ${device.name} (${device.type}) — ${state}`);
    }
  }

  const roomAlerts = alerts.filter(
    (alert) => alert.roomId === room.roomId && alert.status === "active"
  );
  if (roomAlerts.length > 0) {
    lines.push("");
    lines.push(`⚠️ Active alerts for this room: ${roomAlerts.length}`);
    for (const alert of roomAlerts) {
      lines.push(`  • [${alert.severity.toUpperCase()}] ${alert.message}`);
    }
  }

  return lines.join("\n");
}

export function formatUsage(usage: UsageSummary): string {
  const lines: string[] = [];
  lines.push("⚡ Office usage right now");
  lines.push("");
  lines.push(`Total power: ${usage.totalWatt}W`);
  lines.push(`Active devices: ${usage.activeDeviceCount}`);
  lines.push(`Active fans: ${usage.activeFans}`);
  lines.push(`Active lights: ${usage.activeLights}`);
  lines.push(`Estimated today: ${usage.estimatedKwhToday.toFixed(2)} kWh`);

  if (usage.rooms.length > 0) {
    lines.push("");
    lines.push("Per-room breakdown:");
    for (const room of usage.rooms) {
      lines.push(
        `  • ${room.roomName}: ${room.totalWatt}W (fans: ${room.activeFans}, lights: ${room.activeLights})`
      );
    }
  }

  return lines.join("\n");
}

export function formatAlerts(alerts: Alert[]): string {
  if (!alerts.length) {
    return "✅ All clear — no active alerts right now. Office is happy.";
  }

  const lines: string[] = [`🚨 Active alerts: ${alerts.length}`, ""];
  for (const alert of alerts) {
    const emoji = SEVERITY_EMOJI[alert.severity] ?? "•";
    lines.push(`${emoji} [${alert.severity.toUpperCase()}] ${alert.message}`);
    lines.push(`   Type: ${alert.type} • Triggered: ${formatTimestamp(alert.triggeredAt)}`);
  }
  return lines.join("\n");
}

export function formatAlertTriggered(alert: Alert): string {
  const emoji = SEVERITY_EMOJI[alert.severity] ?? "•";
  return [
    `${emoji} New OfficePulse alert`,
    "",
    `[${alert.severity.toUpperCase()}] ${alert.message}`,
    `Type: ${alert.type}`,
    `Triggered: ${formatTimestamp(alert.triggeredAt)}`,
  ].join("\n");
}

export function formatAlertResolved(alert: Alert): string {
  return [
    "✅ OfficePulse alert resolved",
    "",
    alert.message,
    `Type: ${alert.type}`,
    `Resolved: ${formatTimestamp(alert.resolvedAt || alert.triggeredAt)}`,
  ].join("\n");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}
