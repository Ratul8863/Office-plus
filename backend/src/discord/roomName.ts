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

export function resolveRoomId(input: string | undefined | null): CanonicalRoomId | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  if (ALIAS_MAP[key]) return ALIAS_MAP[key];

  const compact = key.replace(/[\s\-_.]/g, "");
  if (compact === "work1") return "work1";
  if (compact === "work2") return "work2";
  if (compact === "drawingroom") return "drawing";

  return null;
}

export function acceptedRoomAliases(): Record<CanonicalRoomId, string[]> {
  return {
    drawing: ["drawing", "drawing room"],
    work1: ["work1", "work room 1"],
    work2: ["work2", "work room 2"],
  };
}
