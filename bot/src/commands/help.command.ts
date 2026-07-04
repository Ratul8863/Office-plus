import { acceptedRoomAliases } from "../utils/roomName.js";

export const helpCommand = {
  name: "help",
  description: "Show the list of available commands",
  execute(): string {
    const rooms = acceptedRoomAliases();
    const roomHelp = (Object.keys(rooms) as Array<keyof typeof rooms>)
      .map((id) => `  • ${id} (${rooms[id].join(", ")})`)
      .join("\n");

    return [
      "🤖 OfficePulse Bot — commands",
      "",
      "All data is read live from the OfficePulse backend.",
      "",
      "!status",
      "  Live office snapshot: room-by-room fan/light counts, total watt,",
      "  today's estimated kWh, and active alert count.",
      "",
      "!room <name>",
      `  Detailed view of one room. Accepted names:`,
      roomHelp,
      "",
      "!usage",
      "  Office-wide watt, kWh-today, active fans/lights, and per-room watt totals.",
      "",
      "!alerts",
      "  List all active alerts (severity, message, timestamp).",
      "  If there are none, you'll get an all-clear message.",
      "",
      "!help",
      "  Show this help message.",
    ].join("\n");
  },
};
