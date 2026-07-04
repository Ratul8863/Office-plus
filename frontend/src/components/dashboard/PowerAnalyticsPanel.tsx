import { Activity, Award, Leaf, Radio, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useOfficeStore } from "@/store/officeStore";
import { computeUsage, formatKwh, formatTime, formatWatt, ROOM_META } from "@/utils/office";

const MAX_BUILDING_WATT = 495;
const ROOM_CAPACITY_WATT = 165;
const CO2_KG_PER_KWH = 0.385;

function getBuildingGrade(totalWatt: number) {
  const loadRatio = totalWatt / MAX_BUILDING_WATT;

  if (loadRatio <= 0.2) return "A+";
  if (loadRatio <= 0.35) return "A";
  if (loadRatio <= 0.55) return "B";
  if (loadRatio <= 0.75) return "C";
  return "D";
}

export function PowerAnalyticsPanel() {
  const devices = useOfficeStore((s) => s.devices);
  const socketConnected = useOfficeStore((s) => s.socketConnected);
  const storeUsage = useOfficeStore((s) => s.usage);
  const usageHistory = useOfficeStore((s) => s.usageHistory);
  const usage = storeUsage || computeUsage(devices);

  const co2FootprintKg = Number((usage.estimatedKwhToday * CO2_KG_PER_KWH).toFixed(4));
  const buildingGrade = getBuildingGrade(usage.totalWatt);
  const chartData = (usageHistory.length > 0
    ? usageHistory
    : [
        {
          timestamp: new Date().toISOString(),
          totalWatt: usage.totalWatt,
          estimatedKwhToday: usage.estimatedKwhToday,
          roomWatts: usage.roomWatts,
          activeDeviceCount: usage.activeDeviceCount,
        },
      ]
  )
    .slice(-18)
    .map((point) => ({
      time: formatTime(point.timestamp).slice(0, 5),
      watts: point.totalWatt,
    }));

  const roomCards = [
    { roomId: "drawing" as const, watts: usage.roomWatts.drawing },
    { roomId: "work1" as const, watts: usage.roomWatts.work1 },
    { roomId: "work2" as const, watts: usage.roomWatts.work2 },
  ];

  const summaryCards = [
    {
      label: "Total Power Draw",
      value: formatWatt(usage.totalWatt),
      subtitle: "live load",
      icon: Zap,
      iconTone: "text-violet-300",
      iconBg: "bg-violet-500/15",
    },
    {
      label: "Usage Today",
      value: formatKwh(usage.estimatedKwhToday),
      subtitle: "estimated",
      icon: Activity,
      iconTone: "text-cyan-300",
      iconBg: "bg-cyan-500/15",
    },
    {
      label: "CO2 Footprint",
      value: `${co2FootprintKg.toFixed(4)} kg`,
      subtitle: `${CO2_KG_PER_KWH} kg / kWh`,
      icon: Leaf,
      iconTone: "text-emerald-300",
      iconBg: "bg-emerald-500/15",
    },
    {
      label: "Building Grade",
      value: buildingGrade,
      subtitle: "efficiency score",
      icon: Award,
      iconTone: "text-sky-300",
      iconBg: "bg-sky-500/15",
    },
  ];

  return (
    <section className="rounded-[28px] border border-border/40 bg-card/40 p-5 lg:p-7 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-amber-200/80">
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            Power Analytics
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Energy consumption and load trends</h2>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
            socketConnected
              ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
              : "border-border/40 bg-background/40 text-muted-foreground"
          }`}
        >
          <Radio className={`h-3.5 w-3.5 ${socketConnected ? "animate-pulse" : ""}`} />
          {socketConnected ? "Live streaming" : "Waiting for stream"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[22px] border border-border/40 bg-background/30 p-4 lg:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconTone}`} />
              </div>
              {card.label === "Building Grade" ? (
                <span className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 font-mono text-2xl font-bold text-emerald-300">
                  {card.value}
                </span>
              ) : null}
            </div>

            <div className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {card.label}
            </div>

            {card.label !== "Building Grade" ? (
              <div className="mt-2 font-mono text-3xl font-bold text-foreground">{card.value}</div>
            ) : null}

            <div className="mt-2 text-xs text-muted-foreground">{card.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[24px] border border-border/40 bg-background/25 p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Room Load Breakdown
          </div>
          <div className="mt-4 space-y-5">
            {roomCards.map((room) => {
              const meta = ROOM_META[room.roomId];
              const percentage = Math.max(
                0,
                Math.min(100, Math.round((room.watts / ROOM_CAPACITY_WATT) * 100))
              );

              return (
                <div key={room.roomId}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{meta.name}</div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {meta.sourceLabel}
                      </div>
                    </div>
                    <div className="font-mono text-lg font-bold text-primary">
                      {Math.round(room.watts)} W
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-background/80">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-indigo-400 via-violet-300 to-cyan-300 transition-all"
                      style={{ width: `${Math.max(room.watts > 0 ? 8 : 0, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-border/40 bg-background/25 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Real-Time Load Curve (W)
            </div>
            <div className="text-xs font-medium text-violet-200">
              {socketConnected ? "Live streaming" : "Session history"}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="power-curve-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8b8fff" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#8b8fff" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="rgba(255,255,255,0.45)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.45)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10, 15, 34, 0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${Math.round(value)} W`, "Load"]}
                />
                <Area
                  type="monotone"
                  dataKey="watts"
                  stroke="#9da0ff"
                  strokeWidth={3}
                  fill="url(#power-curve-fill)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#c4b5fd", stroke: "#0f172a" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
