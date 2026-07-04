import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Fan, Lightbulb, Radio, ShieldCheck } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useOfficeStore, getRoomSummary } from "@/store/officeStore";
import type { Device, RoomId } from "@/types";
import { DeviceIcon } from "@/components/office/DeviceIcon";
import { formatRelative, formatTime, formatWatt, ROOM_META } from "@/utils/office";
import { roomApi } from "@/services/roomApi";
import { toast } from "sonner";

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
  const allAlerts = useOfficeStore((s) => s.alerts);
  const toggle = useOfficeStore((s) => s.toggleDevice);
  const summary = getRoomSummary(devices, rid);
  const meta = ROOM_META[rid];
  const roomDevices = useMemo(() => devices.filter((d) => d.roomId === rid), [devices, rid]);
  const alerts = useMemo(() => allAlerts.filter((a) => a.roomId === rid), [allAlerts, rid]);
  const fans = roomDevices.filter((d) => d.type === "fan");
  const lights = roomDevices.filter((d) => d.type === "light");
  const [masterBusy, setMasterBusy] = useState<string | null>(null);

  const [trend, setTrend] = useState<{ t: string; w: number }[]>(() =>
    Array.from({ length: 14 }, (_, i) => ({
      t: `${i}h`,
      w: Math.max(15, summary.currentWatt * (0.55 + (i % 5) * 0.09)),
    })),
  );

  useEffect(() => {
    setTrend((prev) => [
      ...prev.slice(-13),
      { t: formatTime(new Date().toISOString()).slice(0, 5), w: summary.currentWatt },
    ]);
  }, [summary.currentWatt]);

  const maxDeviceWatt = Math.max(...roomDevices.map((d) => d.ratedWatt), 1);
  const isHardwareRoom = rid === "drawing";

  async function handleMasterControl(status: "on" | "off", type?: "fan" | "light") {
    if (masterBusy) return;
    const busyKey = `${type ?? "all"}-${status}` as any;
    setMasterBusy(busyKey);
    try {
      const result = await roomApi.setMasterState(rid, status, type);
      const label = type === "light" ? "Lights" : type === "fan" ? "Fans" : "All devices";
      toast.success(
        result.mode === "hardware-queued"
          ? `${meta.name} ${label.toLowerCase()} command sent via MQTT (${status.toUpperCase()}).`
          : `${meta.name} ${label.toLowerCase()} set to ${status.toUpperCase()}.`
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Room command failed.");
    } finally {
      setMasterBusy(null);
    }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Hero */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent">
              {meta.sourceLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Stream Active
            </span>
          </div>
          <h1 className="mt-2 text-4xl lg:text-6xl font-bold tracking-tight">{meta.name}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{meta.purpose}</p>
          {isHardwareRoom && (
            <p className="mt-3 max-w-2xl text-sm text-foreground/80">
              This room mirrors the hackathon MQTT control panel: physical switches in the circuit,
              the standalone web controller, and this dashboard all flow through the same backend.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:w-[420px]">
          <StatCard label="Consumption" value={formatWatt(summary.currentWatt)} tone="accent" />
          <StatCard
            label="Devices"
            value={`${summary.activeDevices} / ${summary.totalDevices}`}
            tone="primary"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column */}
        <div className="space-y-4 min-w-0">
          {/* Spatial layout */}
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Spatial Layout</h2>
              <p className="text-xs text-muted-foreground">
                Real-time device positions and energy status
              </p>
            </div>

            <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-background/80 via-background/60 to-accent/10">
              {/* Blueprint grid */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, oklch(0.72 0.18 165 / 0.15) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.18 165 / 0.15) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              {/* Room outline */}
              <div className="absolute inset-6 rounded-lg border-2 border-accent/40" />
              <div className="absolute inset-6 rounded-lg border border-accent/20 shadow-[inset_0_0_60px_oklch(0.72_0.18_165_/_0.15)]" />

              {/* Corner labels */}
              <div className="absolute top-2 left-3 text-[10px] font-mono uppercase tracking-widest text-accent/60">
                {meta.name.toUpperCase()} · ZONE A
              </div>
              <div className="absolute top-2 right-3 text-[10px] font-mono uppercase tracking-widest text-accent/60">
                LIVE TELEMETRY
              </div>
              <div className="absolute bottom-2 left-3 text-[10px] font-mono uppercase tracking-widest text-accent/40">
                MAIN ENTRANCE
              </div>
              <div className="absolute bottom-2 right-3 text-[10px] font-mono uppercase tracking-widest text-accent/40">
                {roomDevices.length} DEVICES
              </div>

              {/* Fan positions (top row) */}
              <div className="absolute top-[22%] left-[25%]">
                <FloorPin device={fans[0]} />
              </div>
              <div className="absolute top-[22%] right-[25%]">
                <FloorPin device={fans[1]} />
              </div>
              {/* Light positions (bottom row) */}
              <div className="absolute bottom-[24%] left-[18%]">
                <FloorPin device={lights[0]} />
              </div>
              <div className="absolute bottom-[24%] left-1/2 -translate-x-1/2">
                <FloorPin device={lights[1]} />
              </div>
              <div className="absolute bottom-[24%] right-[18%]">
                <FloorPin device={lights[2]} />
              </div>
            </div>
          </div>

          {/* Power trend */}
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Power Consumption Trend</h2>
                <p className="text-xs text-muted-foreground">Sampled over recent window</p>
              </div>
              <span className="rounded-full border border-border/50 bg-background/50 px-3 py-1 text-[11px] text-muted-foreground">
                Last 24h
              </span>
            </div>
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={trend}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.85 0.19 165)" />
                      <stop offset="100%" stopColor="oklch(0.5 0.14 165 / 0.4)" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${Math.round(v)} W`, "Power"]}
                  />
                  <Bar dataKey="w" radius={[4, 4, 0, 0]}>
                    {trend.map((_, i) => (
                      <Cell key={i} fill="url(#barGrad)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4 min-w-0">
          <div className={`rounded-2xl border p-5 backdrop-blur ${
            isHardwareRoom
              ? "border-cyan-400/30 bg-cyan-500/5"
              : "border-accent/30 bg-accent/5"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${
                  isHardwareRoom ? "text-cyan-200/80" : "text-accent/80"
                }`}>
                  {isHardwareRoom ? "Hackathon Bridge" : "Room Control"}
                </div>
                <h2 className="mt-1 text-xl font-bold">Master Room Control</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isHardwareRoom
                    ? "Push one command to the ESP32 room bus and let the hardware publish the confirmed state back into OfficePulse."
                    : `Toggle all devices in ${meta.name} at once via the simulator backend.`}
                </p>
              </div>
              <div className={`rounded-full border bg-background/50 px-3 py-1 text-[11px] font-mono ${
                isHardwareRoom ? "border-cyan-400/30 text-cyan-200" : "border-accent/30 text-accent"
              }`}>
                {isHardwareRoom ? "MQTT · smartoffice/drawing" : "Simulator · Direct"}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" /> Lights
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => handleMasterControl("on", "light")}
                  disabled={masterBusy !== null}
                  className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-200 transition-colors hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {masterBusy === "light-on" ? "Sending..." : "All Lights ON"}
                </button>
                <button
                  onClick={() => handleMasterControl("off", "light")}
                  disabled={masterBusy !== null}
                  className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {masterBusy === "light-off" ? "Sending..." : "All Lights OFF"}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Fan className="h-3.5 w-3.5" /> Fans
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => handleMasterControl("on", "fan")}
                  disabled={masterBusy !== null}
                  className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {masterBusy === "fan-on" ? "Sending..." : "All Fans ON"}
                </button>
                <button
                  onClick={() => handleMasterControl("off", "fan")}
                  disabled={masterBusy !== null}
                  className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {masterBusy === "fan-off" ? "Sending..." : "All Fans OFF"}
                </button>
              </div>
            </div>
            {isHardwareRoom && (
              <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground">
                <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                  {"Web command -> backend -> MQTT -> ESP32 -> state echo -> live UI"}
                </div>
                <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                  Individual toggles below still work, but this panel recreates the standalone room
                  website's master switch inside your main dashboard.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <h2 className="mb-4 text-xl font-bold">Active Devices</h2>
            <ul className="space-y-3">
              {roomDevices.map((d) => (
                <li key={d.deviceId}>
                  <button
                    onClick={() => toggle(d.deviceId)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-3 text-left transition-colors hover:bg-background/80"
                  >
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${
                        d.status === "on"
                          ? d.type === "fan"
                            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                            : "border-amber-300/50 bg-amber-300/10 text-amber-200"
                          : "border-border/40 bg-muted/20 text-muted-foreground"
                      }`}
                    >
                      {d.type === "fan" ? (
                        <Fan className={`h-5 w-5 ${d.status === "on" ? "animate-spin [animation-duration:1.4s]" : ""}`} />
                      ) : (
                        <Lightbulb className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{d.name}</div>
                        <div className="font-mono text-sm font-bold text-accent">
                          {Math.round(d.currentWatt)}W
                        </div>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>
                          {d.type === "fan" ? "AIR CIRCULATION" : "LIGHTING"} ·{" "}
                          {d.status === "on" ? "ACTIVE" : "IDLE"}
                        </span>
                        <span className="opacity-70">{formatRelative(d.lastChanged)}</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/40">
                        <div
                          className={`h-full rounded-full transition-all ${
                            d.status === "on"
                              ? d.type === "fan"
                                ? "bg-cyan-400"
                                : "bg-amber-300"
                              : "bg-muted-foreground/30"
                          }`}
                          style={{
                            width: `${Math.max(6, (d.currentWatt / maxDeviceWatt) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Alert history */}
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Alert History</h2>
              <Link to="/alerts" className="text-xs text-accent hover:underline">
                View All
              </Link>
            </div>
            {alerts.length === 0 ? (
              <div className="grid place-items-center gap-2 py-4 text-center text-sm text-muted-foreground">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <span>No alerts for this room.</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {alerts.slice(0, 4).map((a) => {
                  const tone =
                    a.severity === "critical"
                      ? "border-l-red-400 text-red-200"
                      : a.severity === "warning"
                        ? "border-l-amber-300 text-amber-200"
                        : "border-l-cyan-400 text-cyan-200";
                  return (
                    <li key={a.alertId} className={`border-l-2 pl-3 ${tone}`}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatTime(a.createdAt).slice(0, 5)}
                        </span>
                        <span className="text-sm font-semibold">
                          {a.type.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur text-xs text-muted-foreground flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-accent" />
            Telemetry source · <span className="text-foreground font-semibold">{meta.sourceLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "primary";
}) {
  const color = tone === "accent" ? "text-accent" : "text-primary";
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-4 text-center backdrop-blur">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-mono text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function FloorPin({ device }: { device?: Device }) {
  if (!device) return null;
  const on = device.status === "on";
  const isFan = device.type === "fan";
  return (
    <div className="relative flex flex-col items-center">
      {on && (
        <div
          className={`absolute inset-0 -z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full blur-xl ${
            isFan ? "bg-cyan-400/40" : "bg-amber-300/40"
          }`}
        />
      )}
      <DeviceIcon device={device} size="sm" />
      <div className="mt-1 rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        {device.name}
      </div>
    </div>
  );
}
