import { useOfficeStore } from "@/store/officeStore";
import type { Device, RoomId } from "@/types";
import { DeviceIcon } from "@/components/office/DeviceIcon";
import { formatRelative, formatWatt, ROOM_META } from "@/utils/office";

export function DeviceGrid({ roomId }: { roomId?: RoomId }) {
  const devices = useOfficeStore((s) => s.devices);
  const toggle = useOfficeStore((s) => s.toggleDevice);
  const list = roomId ? devices.filter((d) => d.roomId === roomId) : devices;

  const grouped: Record<string, Device[]> = {};
  for (const d of list) (grouped[d.roomName] ??= []).push(d);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([room, items]) => (
        <div key={room} className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {ROOM_META[items[0].roomId].source} source
              </div>
              <div className="text-lg font-bold">{room}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              {items.filter((d) => d.status === "on").length} / {items.length} active
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => toggle(d.deviceId)}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:scale-[1.01] ${
                  d.status === "on"
                    ? "border-cyan-400/40 bg-background/60"
                    : "border-border/40 bg-background/40"
                }`}
              >
                <DeviceIcon device={d} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatWatt(d.currentWatt)} · {formatRelative(d.lastChanged)}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    d.status === "on"
                      ? "bg-cyan-400/20 text-cyan-200"
                      : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {d.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
