import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Cpu, Database, Globe, Radio, Server, Waves } from "lucide-react";

export const Route = createFileRoute("/architecture")({
  component: ArchitecturePage,
});

const NODES = [
  { icon: Cpu, title: "ESP32 Hardware Room", desc: "Hackathon room bridge firing live MQTT state", tone: "text-cyan-300 border-cyan-400/40" },
  { icon: Waves, title: "MQTT Broker", desc: "Low-latency pub/sub transport for telemetry", tone: "text-sky-300 border-sky-400/40" },
  { icon: Server, title: "Node.js Backend", desc: "Single source of truth · business logic", tone: "text-primary border-primary/40" },
  { icon: Database, title: "MongoDB Persistence", desc: "Time-series storage for devices, usage, alerts", tone: "text-emerald-300 border-emerald-400/40" },
  { icon: Radio, title: "Socket.IO Live Stream", desc: "Fan-out live state to every connected client", tone: "text-cyan-300 border-cyan-400/40" },
  { icon: Globe, title: "React Dashboard", desc: "Real-time office energy command center", tone: "text-amber-200 border-amber-400/40" },
  { icon: Bot, title: "Discord Bot", desc: "Chat-based control via backend API", tone: "text-fuchsia-300 border-fuchsia-400/40" },
];

function ArchitecturePage() {
  return (
    <div className="p-4 lg:p-8 space-y-8">
      <header>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          System architecture
        </div>
        <h1 className="text-3xl font-bold tracking-tight">How OfficePulse flows</h1>
        <p className="text-sm text-muted-foreground">End-to-end signal path from silicon to screen.</p>
      </header>

      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 backdrop-blur">
        <p className="text-base leading-relaxed text-foreground/90">
          <span className="font-bold text-primary">The frontend never reads directly from the ESP32 room, MQTT, MongoDB, or Discord.</span>{" "}
          The backend is the single source of truth. Both the dashboard and Discord bot use the same backend state.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {NODES.map((n, i) => (
          <div key={n.title} className="relative">
            <div className={`h-full rounded-2xl border bg-card/40 p-5 backdrop-blur ${n.tone}`}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/60">
                  <n.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Step {i + 1}
                  </div>
                  <div className="font-bold text-foreground">{n.title}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{n.desc}</p>
            </div>
            {i < NODES.length - 1 && (
              <div className="hidden xl:flex absolute -right-3 top-1/2 -translate-y-1/2 items-center text-muted-foreground/70 z-10">
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Contract
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <ul className="space-y-2 text-sm text-foreground/90">
            <li>• REST — <code className="text-cyan-300">GET /api/state</code></li>
            <li>• REST — <code className="text-cyan-300">GET /api/rooms</code></li>
            <li>• REST — <code className="text-cyan-300">GET /api/rooms/:roomId</code></li>
            <li>• REST — <code className="text-cyan-300">GET /api/usage</code></li>
            <li>• REST — <code className="text-cyan-300">GET /api/alerts</code></li>
          </ul>
          <ul className="space-y-2 text-sm text-foreground/90">
            <li>• Socket — <code className="text-emerald-300">office:state</code></li>
            <li>• Socket — <code className="text-emerald-300">device:changed</code></li>
            <li>• Socket — <code className="text-emerald-300">usage:updated</code></li>
            <li>• Socket — <code className="text-emerald-300">alert:new</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
