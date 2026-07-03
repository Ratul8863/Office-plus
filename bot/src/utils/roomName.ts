// Maps free-text room names accepted by the bot to canonical roomIds used by the backend.
// The backend exposes rooms under roomId: "drawing" | "work1" | "work2".

export type CanonicalRoomId = "drawing" | "work1" | "work2";

export interface RoomAlias {
  roomId: CanonicalRoomId;
  roomName: string;
}

export const ROOM_ALIASES: RoomAlias[] = [
  { roomId: "drawing", roomName: "Drawing Room" },
  { roomId: "work1", roomName: "Work Room 1" },
  { roomId: "work2", roomName: "Work Room 2" },
];

const ALIAS_MAP: Record<string, CanonicalRoomId> = {
  drawing: "drawing",
  "drawing room": "drawing",
  work1: "work1",
  "work room 1": "work1",
  work2: "work2",
  "work room 2": "work2",
};

/**
 * Normalize a free-text room argument to the canonical roomId used by the backend.
 * Returns null if no match was found.
 */
export function resolveRoomId(input: string | undefined | null): CanonicalRoomId | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  if (ALIAS_MAP[key]) return ALIAS_MAP[key];

  // Accept short forms like "work-1", "work_1", "work.1"
  const compact = key.replace(/[\s\-_.]/g, "");
  if (compact === "work1") return "work1";
  if (compact === "work2") return "work2";
  if (compact === "drawingroom") return "drawing";

  return null;
}

/**
 * Resolve a list of accepted aliases, useful for the !help message.
 */
export function acceptedRoomAliases(): Record<CanonicalRoomId, string[]> {
  return {
    drawing: ["drawing", "drawing room"],
    work1: ["work1", "work room 1"],
    work2: ["work2", "work room 2"],
  };
}
