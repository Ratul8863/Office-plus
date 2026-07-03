import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useOfficeStore } from "@/store/officeStore";
import { formatRelative } from "@/utils/office";

const SEV_STYLES = {
  info: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
  warning: "border-amber-400/50 bg-amber-500/10 text-amber-200",
  critical: "border-red-500/60 bg-red-500/10 text-red-200",
};

export function AlertsPanel({ limit }: { limit?: number }) {
  const alerts = useOfficeStore((s) => s.alerts);
  const resolveAlert = useOfficeStore((s) => s.resolveAlert);
  const list = alerts.filter((a) => a.active).slice(0, limit);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Active Alerts
          </div>
          <div className="text-lg font-bold">{list.length} live signals</div>
        </div>
        <AlertTriangle className="h-5 w-5 text-amber-300" />
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border/40 py-8 text-center text-muted-foreground">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <span className="text-sm">All clear. No active alerts.</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li
              key={a.alertId}
              className={`rounded-xl border p-3 text-sm ${SEV_STYLES[a.severity]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    {a.type.replaceAll("_", " ")}
                  </div>
                  <p className="mt-0.5 text-foreground/90">{a.message}</p>
                  <div className="mt-1 text-[11px] opacity-70">
                    {formatRelative(a.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => resolveAlert(a.alertId)}
                  className="shrink-0 rounded-md border border-border/50 bg-background/50 px-2 py-1 text-[11px] text-foreground/90 hover:bg-background"
                >
                  Resolve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
