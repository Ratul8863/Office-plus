import { Link } from "@tanstack/react-router";
import { useOfficeStore, getRoomSummary } from "@/store/officeStore";
import type { Device, RoomId } from "@/types";
import { DeviceIcon } from "./DeviceIcon";
import { formatWatt } from "@/utils/office";

function RoomBlock({ roomId, devices }: { roomId: RoomId; devices: Device[] }) {
  const allAlerts = useOfficeStore((s) => s.alerts);
  const alerts = allAlerts.filter((a) => a.active && a.roomId === roomId);
  const summary = getRoomSummary(devices, roomId);
  const roomDevices = devices.filter((d) => d.roomId === roomId);
  const fans = roomDevices.filter((d) => d.type === "fan");
  const lights = roomDevices.filter((d) => d.type === "light");
  const hasAlert = alerts.length > 0;
  const highUsage = summary.currentWatt > 100;

  return (
    <Link
      to="/rooms/$roomId"
      params={{ roomId }}
      className={`group relative flex flex-col rounded-2xl border p-5 backdrop-blur transition-all hover:scale-[1.01] ${
        hasAlert
          ? "border-amber-400/60 bg-amber-500/5 animate-pulse-slow"
          : highUsage
            ? "border-cyan-400/40 bg-cyan-500/5"
            : "border-border/40 bg-card/40"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {summary.activeDevices}/{summary.totalDevices} active
          </div>
          <div className="truncate text-lg font-bold">{summary.name}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-cyan-300">{formatWatt(summary.currentWatt)}</div>
          {hasAlert && <div className="text-[10px] font-bold uppercase text-amber-300">Alert</div>}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-border/30 bg-background/40 p-4">
        <div className="mb-3 flex items-center justify-around">
          {fans.map((d) => (
            <DeviceIcon key={d.deviceId} device={d} />
          ))}
        </div>
        <div className="flex items-center justify-around">
          {lights.map((d) => (
            <DeviceIcon key={d.deviceId} device={d} size="sm" />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider">{ROOM_SOURCE[roomId]}</span>
        <span className="opacity-70 group-hover:opacity-100">View →</span>
      </div>
    </Link>
  );
}

const ROOM_SOURCE: Record<RoomId, string> = {
  drawing: "Simulator",
  work1: "Wokwi",
  work2: "Simulator",
};

export function OfficeMap() {
  const devices = useOfficeStore((s) => s.devices);
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur">
      <div className="mb-4 flex items-center justify-between px-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Top-view floor plan
          </div>
          <div className="text-lg font-bold">Office Layout</div>
        </div>
        <div className="hidden sm:flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Fan</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-300" /> Light</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /> Alert</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <RoomBlock roomId="drawing" devices={devices} />
        <RoomBlock roomId="work1" devices={devices} />
        <RoomBlock roomId="work2" devices={devices} />
      </div>
    </div>
  );
}
