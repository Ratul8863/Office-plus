export interface DeviceConfig {
  deviceId: string;
  name: string;
  type: "fan" | "light";
  roomId: string;
  roomName: string;
  ratedWatt: number;
  source: "wokwi" | "simulator";
}

export const ROOMS = [
  { roomId: "drawing", roomName: "Drawing Room", source: "simulator" },
  { roomId: "work1", roomName: "Work Room 1", source: "wokwi" },
  { roomId: "work2", roomName: "Work Room 2", source: "simulator" },
] as const;

export const INITIAL_DEVICES: DeviceConfig[] = [];

ROOMS.forEach((room) => {
  const devicesInRoom = [
    { name: "Fan 1", type: "fan" as const, ratedWatt: 60, suffix: "fan-1" },
    { name: "Fan 2", type: "fan" as const, ratedWatt: 60, suffix: "fan-2" },
    { name: "Light 1", type: "light" as const, ratedWatt: 15, suffix: "light-1" },
    { name: "Light 2", type: "light" as const, ratedWatt: 15, suffix: "light-2" },
    { name: "Light 3", type: "light" as const, ratedWatt: 15, suffix: "light-3" },
  ];
  
  devicesInRoom.forEach((d) => {
    INITIAL_DEVICES.push({
      deviceId: `${room.roomId}-${d.suffix}`,
      name: d.name,
      type: d.type,
      roomId: room.roomId,
      roomName: room.roomName,
      ratedWatt: d.ratedWatt,
      source: room.source,
    });
  });
});
