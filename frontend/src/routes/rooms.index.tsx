import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Radio } from "lucide-react";
import { useOfficeStore, getRoomSummary } from "@/store/officeStore";
import type { RoomId } from "@/types";
import { DeviceIcon } from "@/components/office/DeviceIcon";
import { formatWatt, ROOM_META } from "@/utils/office";

export const Route = createFileRoute("/rooms/")({
  component: RoomsPage,
});

const ROOM_IDS: RoomId[] = ["drawing", "work1", "work2"];

function RoomsPage() {
  const devices = useOfficeStore((s) => s.devices);
  const allAlerts = useOfficeStore((s) => s.alerts);
  const alerts = allAlerts.filter((a) => a.active);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Rooms overview
        </div>
        <h1 className="text-3xl font-bold tracking-tight">All office rooms</h1>
        <p className="text-sm text-muted-foreground">
          Live status, active devices and power for every room in the office.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ROOM_IDS.map((rid) => {
          const summary = getRoomSummary(devices, rid);
          const meta = ROOM_META[rid];
          const roomDevices = devices.filter((d) => d.roomId === rid);
          const fans = roomDevices.filter((d) => d.type === "fan");
          const lights = roomDevices.filter((d) => d.type === "light");
          const roomAlerts = alerts.filter((a) => a.roomId === rid);
          const hasAlert = roomAlerts.length > 0;

          return (
            <Link
              key={rid}
              to="/rooms/$roomId"
              params={{ roomId: rid }}
              className={`group flex flex-col rounded-2xl border p-5 backdrop-blur transition-all hover:scale-[1.01] ${
                hasAlert
                  ? "border-amber-400/60 bg-amber-500/5 animate-pulse-slow"
                  : "border-border/40 bg-card/40"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {summary.activeDevices}/{summary.totalDevices} active
                  </div>
                  <div className="truncate text-lg font-bold">{summary.name}</div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{meta.purpose}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-lg font-bold text-cyan-300">
                    {formatWatt(summary.currentWatt)}
                  </div>
                  {hasAlert && (
                    <div className="text-[10px] font-bold uppercase text-amber-300">
                      {roomAlerts.length} alert{roomAlerts.length > 1 ? "s" : ""}
                    </div>
                  )}
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

              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                  <Radio className="h-3 w-3" /> {meta.sourceLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-primary opacity-80 group-hover:opacity-100">
                  Open room <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
