import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useOfficeStore } from "@/store/officeStore";
import { formatRelative, ROOM_META } from "@/utils/office";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/alerts")({
  component: AlertsPage,
});

type Filter = "all" | "active" | "resolved" | "info" | "warning" | "critical";
const FILTERS: Filter[] = ["all", "active", "resolved", "info", "warning", "critical"];

const SEV_STYLES = {
  info: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
  warning: "border-amber-400/50 bg-amber-500/10 text-amber-200",
  critical: "border-red-500/60 bg-red-500/10 text-red-200",
};

function AlertsPage() {
  const alerts = useOfficeStore((s) => s.alerts);
  const resolveAlert = useOfficeStore((s) => s.resolveAlert);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filter === "all") return true;
      if (filter === "active") return a.active;
      if (filter === "resolved") return !a.active;
      return a.severity === filter;
    });
  }, [alerts, filter]);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Alerts center
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Active & resolved alerts</h1>
        <p className="text-sm text-muted-foreground">All alert signals from the office energy backend.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
              filter === f
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
            No alerts match this filter.
          </div>
        )}
        {filtered.map((a) => (
          <div
            key={a.alertId}
            className={`rounded-2xl border p-5 backdrop-blur ${SEV_STYLES[a.severity]}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
                  {a.active ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {a.type.replaceAll("_", " ")} · {a.severity}
                </div>
                <p className="mt-1 text-foreground/90">{a.message}</p>
                <div className="mt-2 text-[11px] opacity-70">
                  {a.roomId && `${ROOM_META[a.roomId].name} · `}
                  Created {formatRelative(a.createdAt)}
                  {a.resolvedAt && ` · Resolved ${formatRelative(a.resolvedAt)}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    a.active ? "bg-amber-500/25 text-amber-100" : "bg-emerald-500/25 text-emerald-100"
                  }`}
                >
                  {a.active ? "Active" : "Resolved"}
                </span>
                {a.active && (
                  <button
                    onClick={() => resolveAlert(a.alertId)}
                    className="rounded-md border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] text-foreground/90 hover:bg-background"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
