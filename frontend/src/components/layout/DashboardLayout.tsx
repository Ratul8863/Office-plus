import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  DoorOpen,
  LayoutDashboard,
  Menu,
  Network,
  Sliders,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useOfficeStore } from "@/store/officeStore";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/rooms", label: "Rooms", icon: DoorOpen },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/architecture", label: "Architecture", icon: Network },
  { to: "/simulation", label: "Simulation", icon: Sliders },
];

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const alerts = useOfficeStore((s) => s.alerts);
  const activeAlerts = alerts.filter((a) => a.active).length;
  const wokwi = useOfficeStore((s) => s.wokwiConnected);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight">OfficePulse</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-md border border-border/50 bg-card/60"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-30 h-screen w-64 shrink-0 border-r border-border/50 bg-card/40 backdrop-blur-xl transition-transform`}
        >
          <div className="flex h-full flex-col p-5">
            <Link to="/" className="flex items-center gap-3 pb-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-glow">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-bold tracking-tight">OfficePulse</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Energy Intelligence
                </div>
              </div>
            </Link>

            <nav className="flex flex-col gap-1">
              {NAV.map((n) => {
                const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-primary/15 text-primary shadow-inner"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <n.icon className="h-4 w-4" />
                    <span className="flex-1">{n.label}</span>
                    {n.to === "/alerts" && activeAlerts > 0 && (
                      <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                        {activeAlerts}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-2 rounded-xl border border-border/40 bg-background/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Backend</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Wokwi</span>
                <span
                  className={`flex items-center gap-1.5 ${
                    wokwi ? "text-cyan-400" : "text-destructive"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      wokwi ? "bg-cyan-400 animate-pulse" : "bg-destructive"
                    }`}
                  />
                  {wokwi ? "Connected" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Simulator</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Activity className="h-3 w-3" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </aside>

        {open && (
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-20 bg-black/60 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
