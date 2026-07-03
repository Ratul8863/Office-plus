import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Fan,
  Info,
  Lightbulb,
  Power,
  Search,
  ShieldAlert,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { useOfficeStore } from "@/store/officeStore";
import type { Alert, AlertType } from "@/types";
import { formatTime, ROOM_META } from "@/utils/office";

export const Route = createFileRoute("/alerts")({
  component: AlertsPage,
});

type Filter = "all" | "active" | "resolved" | "info" | "warning" | "critical";
const FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "resolved", label: "Resolved" },
  { key: "info", label: "Info", dot: "bg-cyan-400" },
  { key: "warning", label: "Warning", dot: "bg-amber-300" },
  { key: "critical", label: "Critical", dot: "bg-red-400" },
];

const TYPE_ICON: Record<AlertType, typeof Fan> = {
  AFTER_HOURS_ON: Clock,
  ROOM_FULLY_ON_TOO_LONG: Lightbulb,
  HIGH_USAGE: TrendingUp,
  DEVICE_OFFLINE: WifiOff,
};

const TYPE_LABEL: Record<AlertType, string> = {
  AFTER_HOURS_ON: "After-Hours Devices ON",
  ROOM_FULLY_ON_TOO_LONG: "Room Fully-ON Too Long",
  HIGH_USAGE: "High Power Usage",
  DEVICE_OFFLINE: "Telemetry Offline",
};

function AlertsPage() {
  const alerts = useOfficeStore((s) => s.alerts);
  const resolveAlert = useOfficeStore((s) => s.resolveAlert);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.active);
    const critical = active.filter((a) => a.severity === "critical").length;
    const warning = active.filter((a) => a.severity === "warning").length;
    const total = alerts.length || 1;
    const resolved = alerts.filter((a) => !a.active).length;
    const rate = Math.round((resolved / total) * 100);
    return { active: active.length, critical, warning, rate };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => {
        if (filter === "all") return true;
        if (filter === "active") return a.active;
        if (filter === "resolved") return !a.active;
        return a.severity === filter;
      })
      .filter((a) => {
        if (!q.trim()) return true;
        const hay = `${a.message} ${a.roomId ? ROOM_META[a.roomId].name : ""} ${a.deviceId ?? ""}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      });
  }, [alerts, filter, q]);

  const active = filtered.filter((a) => a.active);
  const history = alerts
    .slice()
    .sort((a, b) => (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt))
    .slice(0, 8);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-accent">Alerts</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> Past 24 Hours
        </span>
      </header>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Active Issues" value={String(stats.active)} icon={TrendingUp} tone="rose" />
        <Kpi label="Critical Alerts" value={pad2(stats.critical)} icon={ShieldAlert} tone="rose" />
        <Kpi label="Warning Status" value={pad2(stats.warning)} icon={AlertTriangle} tone="amber" />
        <Kpi label="Resolution Rate" value={`${stats.rate}%`} icon={CheckCircle2} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? "border-accent/50 bg-accent/20 text-accent"
                : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by room or device..."
            className="w-full rounded-full border border-border/40 bg-card/50 py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-accent/50"
          />
        </div>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(alerts, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "officepulse-alerts.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-4 py-2 text-sm font-semibold text-foreground hover:bg-card"
        >
          <Download className="h-4 w-4" /> Export Logs
        </button>
      </div>

      {/* Alert cards grid */}
      {active.length === 0 && filter !== "resolved" ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-2 text-sm text-muted-foreground">No matching alerts.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(filter === "resolved" ? filtered : active).map((a) => (
            <AlertCard key={a.alertId} alert={a} onResolve={() => resolveAlert(a.alertId)} />
          ))}
        </div>
      )}

      {/* Resolution history */}
      <section className="pt-4">
        <h2 className="mb-4 text-2xl font-bold">Alert Resolution History</h2>
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/40 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-background/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3 text-left font-semibold">Timestamp</th>
                  <th className="px-5 py-3 text-left font-semibold">Severity</th>
                  <th className="px-5 py-3 text-left font-semibold">Component</th>
                  <th className="px-5 py-3 text-left font-semibold">Issue</th>
                  <th className="px-5 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.alertId} className="border-b border-border/20 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(a.resolvedAt ?? a.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <SeverityChip severity={a.severity} />
                    </td>
                    <td className="px-5 py-3 text-foreground/90 whitespace-nowrap">
                      {a.roomId ? ROOM_META[a.roomId].name : "System"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{a.message}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          a.active
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-emerald-500/20 text-emerald-200"
                        }`}
                      >
                        {a.active ? "Active" : "Resolved"}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                      No alert history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Fan;
  tone: "rose" | "amber" | "emerald";
}) {
  const map = {
    rose: { v: "text-rose-300", i: "bg-rose-500/15 text-rose-300 border-rose-400/30" },
    amber: { v: "text-amber-300", i: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
    emerald: { v: "text-emerald-300", i: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
  }[tone];
  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 p-5 backdrop-blur">
      <div className="text-xs font-semibold text-foreground/80">{label}</div>
      <div className="mt-3 flex items-center justify-between">
        <div className={`font-mono text-4xl font-bold ${map.v}`}>{value}</div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl border ${map.i}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SeverityChip({ severity }: { severity: Alert["severity"] }) {
  const map = {
    info: { c: "text-cyan-300", dot: "bg-cyan-400", label: "INFO" },
    warning: { c: "text-amber-300", dot: "bg-amber-300", label: "WARN" },
    critical: { c: "text-red-300", dot: "bg-red-400", label: "CRIT" },
  }[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${map.c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
}

function AlertCard({ alert, onResolve }: { alert: Alert; onResolve: () => void }) {
  const Icon = TYPE_ICON[alert.type];
  const border =
    alert.severity === "critical"
      ? "border-l-red-400"
      : alert.severity === "warning"
        ? "border-l-amber-300"
        : "border-l-cyan-400";
  const chipStyles =
    alert.severity === "critical"
      ? "bg-red-500/20 text-red-200"
      : alert.severity === "warning"
        ? "bg-amber-500/20 text-amber-200"
        : "bg-cyan-500/20 text-cyan-200";

  const iconTone =
    alert.severity === "critical"
      ? "bg-red-500/15 text-red-300"
      : alert.severity === "warning"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-cyan-500/15 text-cyan-300";

  return (
    <div className={`rounded-2xl border border-border/40 border-l-4 ${border} bg-card/50 p-5 backdrop-blur`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-bold">{TYPE_LABEL[alert.type]}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{alert.roomId ? ROOM_META[alert.roomId].name : "System-wide"}</span>
                {alert.deviceId && <span>· {alert.deviceId}</span>}
              </div>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${chipStyles}`}>
                {alert.severity}
              </span>
              <div className="font-mono text-[11px] text-muted-foreground">
                {formatTime(alert.createdAt)}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm text-foreground/85">{alert.message}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {alert.active ? "Awaiting acknowledgement" : "Resolved"}
            </div>
            {alert.active && (
              <button
                onClick={onResolve}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent hover:bg-accent/25"
              >
                <Power className="h-3 w-3" /> Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// keep Info import used
void Info;
