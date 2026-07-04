import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Clock } from "lucide-react";
import { OfficeMap } from "@/components/office/OfficeMap";
import { PowerAnalyticsPanel } from "@/components/dashboard/PowerAnalyticsPanel";
import { SmartAutomationPanel } from "@/components/dashboard/SmartAutomationPanel";
import { DiscordBotPanel } from "@/components/dashboard/DiscordBotPanel";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { useOfficeStore } from "@/store/officeStore";
import { formatTime } from "@/utils/office";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const lastUpdated = useOfficeStore((s) => s.lastUpdated);
  const backendConnected = useOfficeStore((s) => s.backendConnected);
  const socketConnected = useOfficeStore((s) => s.socketConnected);
  const tick = useOfficeStore((s) => s.tick);
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date().toISOString());
    const id = setInterval(() => {
      setNow(new Date().toISOString());
      tick();
    }, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const isLive = backendConnected && socketConnected;

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-5 max-w-[1600px] mx-auto">
      <header className="relative overflow-hidden rounded-3xl border border-border/30 bg-linear-to-br from-violet-950/50 via-card/60 to-cyan-950/40 px-6 py-5 lg:px-8 lg:py-6 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.1),transparent_50%)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${
                isLive
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : backendConnected
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
                    : "border-red-400/30 bg-red-500/10 text-red-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive
                    ? "bg-emerald-400 animate-pulse"
                    : backendConnected
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
              />
              {isLive ? "Live" : backendConnected ? "Connecting…" : "Demo Mode"}
            </span>

            <h1 className="mt-3 text-3xl lg:text-4xl font-extrabold tracking-tight bg-linear-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-transparent">
              OfficePulse
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground/70">
              Real-time office energy intelligence
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border/30 bg-background/20 px-4 py-2 text-xs font-mono text-muted-foreground backdrop-blur">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-violet-400" />
              {now ? formatTime(now) : "--:--:--"}
            </span>
            <span className="h-3 w-px bg-border/40" />
            <span className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-cyan-400" />
              {formatTime(lastUpdated)}
            </span>
          </div>
        </div>
      </header>

      <PowerAnalyticsPanel />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <OfficeMap />
          <SmartAutomationPanel />
        </div>
        <div className="space-y-5">
          <AlertsPanel limit={5} />
          <ActivityFeed />
        </div>
      </div>

      <DiscordBotPanel />
    </div>
  );
}
