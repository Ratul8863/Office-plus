import type { DeviceState, UsageResponse } from "../api/backendClient.js";
import type { Alert } from "../api/backendClient.js";
import { ROOM_ALIASES } from "../utils/roomName.js";

/**
 * Format a Discord-friendly office snapshot.
 *
 * The bot NEVER invents numbers: every figure is read from the backend's
 * /api/state, /api/usage, and /api/alerts/active payloads.
 */
export function formatStatus(args: {
  devices: DeviceState[];
  usage: UsageResponse["data"];
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
    if (!anyOn) {
      roomLines.push(`${room.roomName}: all devices OFF`);
    } else {
      roomLines.push(`${room.roomName}: ${fanText}, ${lightText}`);
    }
  }

  const totalPower = `${usage.totalWatt}W`;
  const kwh = `${usage.estimatedKwhToday.toFixed(2)} kWh`;
  const activeAlerts = alerts.length;

  return [
    "Boss, here's the live office snapshot 👀",
    "",
    ...roomLines,
    "",
    `Total power right now: ${totalPower}`,
    `Today's estimated usage: ${kwh}`,
    `Active alerts: ${activeAlerts}`,
  ].join("\n");
}