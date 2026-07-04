import { getBackendClient } from "../api/backendClient.js";
import { formatRoom } from "../formatters/roomFormatter.js";
import { resolveRoomId } from "../utils/roomName.js";

export const roomCommand = {
  name: "room",
  description: "Per-device view of a single room",
  async execute(args: string[]): Promise<string> {
    const raw = args.join(" ").trim();
    if (!raw) {
      return [
        "Which room should I check?",
        "Try: `!room drawing`, `!room work1`, `!room work room 2`.",
      ].join("\n");
    }

    const roomId = resolveRoomId(raw);
    if (!roomId) {
      return [
        `I don't recognize the room "${raw}".`,
        "Accepted names: drawing, drawing room, work1, work room 1, work2, work room 2.",
      ].join("\n");
    }

    const api = getBackendClient();
    const [room, alerts] = await Promise.all([
      api.getRoom(roomId),
      api.getActiveAlerts(),
    ]);
    return formatRoom({ room, alerts });
  },
};
