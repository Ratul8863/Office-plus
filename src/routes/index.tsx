import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radio, Server, Zap } from "lucide-react";
import { OfficeMap } from "@/components/office/OfficeMap";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { RoomBreakdown } from "@/components/dashboard/RoomBreakdown";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { DeviceGrid } from "@/components/devices/DeviceGrid";
import { useOfficeStore } from "@/store/officeStore";
import { formatTime } from "@/utils/office";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const lastUpdated = useOfficeStore((s) => s.lastUpdated);
  const tick = useOfficeStore((s) => s.tick);
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date().toISOString());
      tick();
    }, 1000);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip icon={Server} tone="emerald" label="Live Backend" />
            <Chip icon={Radio} tone="cyan" label="Wokwi + Simulator" />
            <Chip icon={Zap} tone="primary" label="Single Source of Truth" />
          </div>
          <h1 className="mt-3 text-3xl lg:text-4xl font-bold tracking-tight">OfficePulse</h1>
          <p className="text-sm text-muted-foreground">Real-Time Office Energy Intelligence</p>
        </div>
        <div className="text-right text-xs text-muted-foreground font-mono">
          <div>Now · {formatTime(now)}</div>
          <div>Updated · {formatTime(lastUpdated)}</div>
        </div>
      </header>

      <SummaryCards />
      <OfficeMap />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <RoomBreakdown />
          <DeviceGrid />
        </div>
        <div className="space-y-4">
          <AlertsPanel limit={5} />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, tone, label }: { icon: typeof Zap; tone: "emerald" | "cyan" | "primary"; label: string }) {
  const styles = {
    emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    cyan: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    primary: "border-primary/40 bg-primary/10 text-primary",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
