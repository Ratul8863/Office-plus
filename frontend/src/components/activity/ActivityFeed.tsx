import { AlertTriangle, Radio, Settings, Zap } from "lucide-react";
import { useOfficeStore } from "@/store/officeStore";
import { formatRelative } from "@/utils/office";

const ICONS = {
  DEVICE_CHANGED: Zap,
  ALERT_CREATED: AlertTriangle,
  TELEMETRY_RECEIVED: Radio,
  SYSTEM: Settings,
} as const;

const TONES = {
  DEVICE_CHANGED: "text-cyan-300",
  ALERT_CREATED: "text-amber-300",
  TELEMETRY_RECEIVED: "text-emerald-300",
  SYSTEM: "text-muted-foreground",
} as const;

export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const activity = useOfficeStore((s) => s.activity).slice(0, limit);
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Recent Activity
        </div>
        <div className="text-lg font-bold">Live event stream</div>
      </div>
      <ul className="space-y-3">
        {activity.map((e) => {
          const Icon = ICONS[e.type];
          return (
            <li key={e.eventId} className="flex items-start gap-3 text-sm">
              <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background/60 border border-border/40 ${TONES[e.type]}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground/90">{e.message}</p>
                <div className="text-[11px] text-muted-foreground">{formatRelative(e.createdAt)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
