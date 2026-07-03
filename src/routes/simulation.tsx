import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Clock,
  Fan,
  LayoutGrid,
  Lightbulb,
  Radio,
  RefreshCw,
  Shuffle,
  Sparkles,
  TrendingUp,
  WifiOff,
  Zap,
} from "lucide-react";
import { useOfficeStore } from "@/store/officeStore";
import { computeUsage, ROOM_META } from "@/utils/office";
import type { Device } from "@/types";

export const Route = createFileRoute("/simulation")({
  component: SimulationPage,
});

const PRESETS = [
  {
    key: "AFTER_HOURS_ON" as const,
    title: "After-Hours Alert",
    subtitle: "Security focus & low energy mode",
    icon: Clock,
  },
  {
    key: "ROOM_FULLY_ON_TOO_LONG" as const,
    title: "All Devices ON",
    subtitle: "Peak occupancy simulation",
    icon: Zap,
  },
  {
    key: "DEVICE_OFFLINE" as const,
    title: "Wokwi Disconnect",
    subtitle: "Hardware failure testing",
    icon: WifiOff,
  },
];

function SimulationPage() {
  const devices = useOfficeStore((s) => s.devices);
  const toggle = useOfficeStore((s) => s.toggleDevice);
  const randomize = useOfficeStore((s) => s.randomize);
  const reset = useOfficeStore((s) => s.reset);
  const triggerAlert = useOfficeStore((s) => s.triggerAlert);
  const simulateWokwiDisconnect = useOfficeStore((s) => s.simulateWokwiDisconnect);
  const wokwi = useOfficeStore((s) => s.wokwiConnected);

  const activeCount = devices.filter((d) => d.status === "on").length;
  const usage = useMemo(() => computeUsage(devices), [devices]);
  const loadPct = Math.min(100, Math.round((usage.totalWatt / (60 * 6 + 15 * 9)) * 100));
  const loadLabel = loadPct > 66 ? "High" : loadPct > 33 ? "Medium" : "Low";

  const [ambient, setAmbient] = useState(22.4);
  const [occupancy, setOccupancy] = useState(42);

  function runPreset(key: (typeof PRESETS)[number]["key"]) {
    if (key === "DEVICE_OFFLINE") {
      simulateWokwiDisconnect();
      triggerAlert("DEVICE_OFFLINE");
    } else {
      triggerAlert(key);
    }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Workspace / </span>
          <span className="text-accent font-semibold">Simulation Environment</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-3 py-1.5 text-xs">
          <Radio className={`h-3.5 w-3.5 ${wokwi ? "text-emerald-300" : "text-red-300"}`} />
          <span className="font-mono">{activeCount}</span> Active Nodes · {devices.length} Total
        </span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">Environment Simulator</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manipulate office conditions and individual device states to test automation workflows.{" "}
            <span className="text-accent">
              These controls are frontend mock controls. In production, device state will come from
              the backend through Socket.IO.
            </span>
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-4 py-2 text-sm font-semibold hover:bg-card"
        >
          <RefreshCw className="h-4 w-4" /> Reset Simulation
        </button>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 min-w-0">
          {/* Scenario Presets */}
          <Panel icon={LayoutGrid} title="Scenario Presets">
            <div className="grid gap-3 sm:grid-cols-3">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => runPreset(p.key)}
                  className="group rounded-xl border border-border/40 bg-background/40 p-4 text-left transition-all hover:border-accent/40 hover:bg-background/70"
                >
                  <p.icon className="h-5 w-5 text-accent" />
                  <div className="mt-3 font-bold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.subtitle}</div>
                </button>
              ))}
            </div>
          </Panel>

          {/* Device Matrix */}
          <Panel
            icon={LayoutGrid}
            title={`Device Matrix (1-${devices.length})`}
            action={
              <button
                onClick={randomize}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/25"
              >
                <Shuffle className="h-3.5 w-3.5" /> Randomize States
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {devices.map((d, i) => (
                <NodeCard key={d.deviceId} device={d} idx={i + 1} onToggle={() => toggle(d.deviceId)} />
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Tap any node to toggle its state. Only fans (60W) and
              lights (15W) — 3 rooms × 5 devices = 15 total.
            </p>
          </Panel>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 min-w-0">
          <Panel icon={Sparkles} title="Environment Variables">
            <div className="space-y-5">
              <SliderRow
                label="Ambient Temperature"
                value={`${ambient.toFixed(1)}°C`}
                min={16}
                max={32}
                step={0.1}
                v={ambient}
                onChange={setAmbient}
              />
              <SliderRow
                label="Occupancy Level"
                value={`${occupancy}%`}
                min={0}
                max={100}
                v={occupancy}
                onChange={setOccupancy}
              />
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Load</span>
                  <span
                    className={
                      loadLabel === "High"
                        ? "text-red-300"
                        : loadLabel === "Medium"
                          ? "text-amber-300"
                          : "text-accent"
                    }
                  >
                    {loadLabel}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-400 transition-all"
                    style={{ width: `${Math.max(6, loadPct)}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                  {Math.round(usage.totalWatt)} W total
                </div>
              </div>
            </div>
          </Panel>

          <Panel icon={BrainCircuit} title="Logic Flow">
            <div className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-background/60 via-accent/5 to-background/60 p-6">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, oklch(0.72 0.18 165 / 0.2) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.18 165 / 0.2) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative flex flex-col items-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full border border-accent/40 bg-background/70 shadow-[0_0_30px_oklch(0.72_0.18_165_/_0.4)]">
                  <BrainCircuit className="h-6 w-6 text-accent" />
                </div>
                <div className="mt-4 text-sm font-bold uppercase tracking-widest text-accent">
                  Mock Stream Active
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Simulation logic interpreting device state changes in real time. Backend Socket.IO
                  connection will replace this in production.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 w-full">
                  {Object.entries(ROOM_META).map(([id, m]) => (
                    <div key={id} className="rounded-lg border border-border/40 bg-background/50 p-2 text-center">
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {m.source}
                      </div>
                      <div className="text-xs font-bold truncate">{m.name.split(" ")[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <button
            onClick={() => triggerAlert("HIGH_USAGE")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-500/20"
          >
            <AlertTriangle className="h-4 w-4" /> Trigger High Usage Alert
          </button>
        </aside>
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Fan;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function NodeCard({ device, idx, onToggle }: { device: Device; idx: number; onToggle: () => void }) {
  const on = device.status === "on";
  const Icon = device.type === "fan" ? Fan : Lightbulb;
  return (
    <button
      onClick={onToggle}
      className={`group flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
        on
          ? "border-accent/60 bg-accent/10 shadow-[0_0_25px_oklch(0.72_0.18_165_/_0.25)]"
          : "border-border/40 bg-background/40 hover:border-border/70"
      }`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-full ${
          on ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground"
        }`}
      >
        <Icon className={`h-5 w-5 ${on && device.type === "fan" ? "animate-spin [animation-duration:1.4s]" : ""}`} />
      </div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Node {String(idx).padStart(2, "0")}
      </div>
      <div className="text-sm font-bold capitalize">{device.type}</div>
      <div
        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
          on ? "text-accent" : "text-muted-foreground"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-muted-foreground"}`} />
        {on ? "Online" : "Offline"}
      </div>
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  v,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  v: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-accent">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[oklch(0.72_0.18_165)]"
      />
    </div>
  );
}
