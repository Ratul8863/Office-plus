import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Radio } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useOfficeStore, getRoomSummary } from "@/store/officeStore";
import type { RoomId } from "@/types";
import { DeviceGrid } from "@/components/devices/DeviceGrid";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { DeviceIcon } from "@/components/office/DeviceIcon";
import { formatWatt, ROOM_META } from "@/utils/office";

const VALID: RoomId[] = ["drawing", "work1", "work2"];

export const Route = createFileRoute("/rooms/$roomId")({
  beforeLoad: ({ params }) => {
    if (!VALID.includes(params.roomId as RoomId)) throw notFound();
  },
  component: RoomDetailPage,
});

function RoomDetailPage() {
  const { roomId } = Route.useParams();
  const rid = roomId as RoomId;
  const devices = useOfficeStore((s) => s.devices);
  const alerts = useOfficeStore((s) => s.alerts.filter((a) => a.roomId === rid));
  const summary = getRoomSummary(devices, rid);
  const meta = ROOM_META[rid];
  const roomDevices = devices.filter((d) => d.roomId === rid);

  const [trend, setTrend] = useState<{ t: string; w: number }[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({ t: `${i}`, w: summary.currentWatt })),
  );

  useEffect(() => {
    setTrend((prev) => [...prev.slice(-19), { t: new Date().toLocaleTimeString(), w: summary.currentWatt }]);
  }, [summary.currentWatt]);

  const fans = useMemo(() => roomDevices.filter((d) => d.type === "fan"), [roomDevices]);
  const lights = useMemo(() => roomDevices.filter((d) => d.type === "light"), [roomDevices]);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Room detail
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{meta.name}</h1>
            <p className="text-sm text-muted-foreground">{meta.purpose}</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-4xl font-bold text-cyan-300">{formatWatt(summary.currentWatt)}</div>
            <div className="text-xs text-muted-foreground">
              {summary.activeDevices} / {summary.totalDevices} devices active
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              <Radio className="h-3 w-3" /> Source · {meta.source}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Power Trend
              </div>
              <div className="text-lg font-bold">Live watts</div>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="t" hide />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} unit="W" />
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                  <Area dataKey="w" stroke="#22d3ee" strokeWidth={2} fill="url(#area)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <DeviceGrid roomId={rid} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Mini layout
              </div>
              <div className="text-lg font-bold">{meta.name}</div>
            </div>
            <div className="rounded-xl border border-border/30 bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-around">
                {fans.map((d) => <DeviceIcon key={d.deviceId} device={d} />)}
              </div>
              <div className="flex items-center justify-around">
                {lights.map((d) => <DeviceIcon key={d.deviceId} device={d} size="sm" />)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Alert history
              </div>
              <div className="text-lg font-bold">{alerts.length} events</div>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts for this room.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.map((a) => (
                  <li key={a.alertId} className="rounded-lg border border-border/40 bg-background/40 p-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">
                      {a.type.replaceAll("_", " ")} · {a.severity}
                    </div>
                    <p>{a.message}</p>
                    <div className="text-[11px] text-muted-foreground">
                      {a.active ? "Active" : "Resolved"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AlertsPanel limit={3} />
        </div>
      </div>
    </div>
  );
}
