import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { officeApi } from "@/services/officeApi";
import { simulatorApi, type SimulatorStatus } from "@/services/simulatorApi";
import { toast } from "sonner";

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
    title: "Hardware Disconnect",
    subtitle: "UI-only Drawing Room bridge failure test",
    icon: WifiOff,
  },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function SimulationPage() {
  const devices = useOfficeStore((s) => s.devices);
  const toggle = useOfficeStore((s) => s.toggleDevice);
  const randomize = useOfficeStore((s) => s.randomize);
  const reset = useOfficeStore((s) => s.reset);
  const setDeviceStatus = useOfficeStore((s) => s.setDeviceStatus);
  const triggerAlert = useOfficeStore((s) => s.triggerAlert);
  const simulateWokwiDisconnect = useOfficeStore((s) => s.simulateWokwiDisconnect);
  const updateSingleDevice = useOfficeStore((s) => s.updateSingleDevice);
  const wokwi = useOfficeStore((s) => s.wokwiConnected);
  const backendConnected = useOfficeStore((s) => s.backendConnected);

  // Auto simulation (backend-driven, optional)
  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const refreshSimStatus = useCallback(async () => {
    try {
      const status = await simulatorApi.getStatus();
      setSimStatus(status);
    } catch {
      setSimStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshSimStatus();
    const id = setInterval(refreshSimStatus, 3000);
    return () => clearInterval(id);
  }, [refreshSimStatus]);

  async function startAutoSimulation() {
    if (simBusy || bulkBusy) return;
    setSimBusy(true);
    try {
      const result = await simulatorApi.start();
      toast.success(
        result.started
          ? `Auto simulation started (every ${Math.round((result.intervalMs ?? 8000) / 1000)}s)`
          : `Auto simulation: ${result.reason ?? "not started"}`,
      );
      await refreshSimStatus();
    } catch (err: unknown) {
      toast.error(`Could not start auto simulation: ${getErrorMessage(err)}`);
    } finally {
      setSimBusy(false);
    }
  }

  async function stopAutoSimulation() {
    if (simBusy || bulkBusy) return;
    setSimBusy(true);
    try {
      await simulatorApi.stop();
      toast.success("Auto simulation stopped.");
      await refreshSimStatus();
    } catch (err: unknown) {
      toast.error(`Could not stop auto simulation: ${getErrorMessage(err)}`);
    } finally {
      setSimBusy(false);
    }
  }

  async function triggerOneTick() {
    if (simBusy || bulkBusy) return;
    setSimBusy(true);
    try {
      const result = await simulatorApi.toggleRandom();
      if (result.tick) {
        toast.success(`Toggled ${result.tick.deviceId} → ${result.tick.newStatus.toUpperCase()}`);
      } else {
        toast.error("No simulator devices available to toggle.");
      }
      await refreshSimStatus();
    } catch (err: unknown) {
      toast.error(`Tick failed: ${getErrorMessage(err)}`);
    } finally {
      setSimBusy(false);
    }
  }

  const storeUsage = useOfficeStore((s) => s.usage);
  const usage = useMemo(() => storeUsage || computeUsage(devices), [devices, storeUsage]);
  const activeCount = usage.activeDeviceCount;
  const loadPct = Math.min(100, Math.round((usage.totalWatt / (60 * 6 + 15 * 9)) * 100));
  const loadLabel = loadPct > 66 ? "High" : loadPct > 33 ? "Medium" : "Low";
  const simulatorDevices = useMemo(
    () => devices.filter((device) => device.source === "simulator"),
    [devices],
  );

  const [activity, setActivity] = useState(58);
  const [occupancy, setOccupancy] = useState(42);

  const applyTargetsLocally = useCallback(
    (targets: Map<string, "on" | "off">) => {
      targets.forEach((status, deviceId) => {
        setDeviceStatus(deviceId, status);
      });
    },
    [setDeviceStatus],
  );

  const syncDevicesToTargets = useCallback(
    async (targets: Map<string, "on" | "off">, successMessage: string) => {
      const devicesToChange = devices.filter((device) => {
        const targetStatus = targets.get(device.deviceId);
        return targetStatus && targetStatus !== device.status;
      });

      if (devicesToChange.length === 0) {
        toast.success("Devices already match this scenario.");
        return;
      }

      let syncedCount = 0;
      let queuedHardwareCount = 0;
      let failedCount = 0;
      let firstError = "";

      for (const device of devicesToChange) {
        const targetStatus = targets.get(device.deviceId);
        if (!targetStatus) continue;

        try {
          const result = await officeApi.toggleDevice(device.deviceId, targetStatus);
          syncedCount += 1;

          if (result.mode === "direct") {
            updateSingleDevice(result.device);
          } else {
            queuedHardwareCount += 1;
          }
        } catch (err: unknown) {
          failedCount += 1;
          firstError ||= getErrorMessage(err);
        }
      }

      await refreshSimStatus();

      if (syncedCount > 0) {
        toast.success(
          `${successMessage}${
            queuedHardwareCount > 0
              ? ` · ${queuedHardwareCount} hardware command${queuedHardwareCount === 1 ? "" : "s"} queued`
              : ""
          }`,
        );
      }

      if (failedCount > 0) {
        toast.error(
          `Couldn't sync ${failedCount} device${failedCount === 1 ? "" : "s"}${
            firstError ? `: ${firstError}` : ""
          }`,
        );
      }
    },
    [devices, refreshSimStatus, updateSingleDevice],
  );

  async function handleResetSimulation() {
    if (simBusy || bulkBusy) return;
    setBulkBusy("reset");
    try {
      if (!backendConnected) {
        reset();
        toast.success("Local simulation reset.");
        return;
      }

      if (simStatus?.autoRunning) {
        await simulatorApi.stop();
      }

      const targets = new Map<string, "on" | "off">(
        devices.map((device) => [device.deviceId, "off"]),
      );
      await syncDevicesToTargets(targets, "Simulation reset across live devices.");
    } catch (err: unknown) {
      toast.error(`Reset failed: ${getErrorMessage(err)}`);
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleRandomizeStates() {
    if (simBusy || bulkBusy) return;
    setBulkBusy("randomize");
    try {
      if (!backendConnected) {
        randomize();
        toast.success("Simulator devices randomized locally.");
        return;
      }

      const targets = new Map<string, "on" | "off">(
        simulatorDevices.map((device) => [device.deviceId, Math.random() > 0.45 ? "on" : "off"]),
      );
      await syncDevicesToTargets(targets, "Simulator devices randomized.");
    } catch (err: unknown) {
      toast.error(`Randomize failed: ${getErrorMessage(err)}`);
    } finally {
      setBulkBusy(null);
    }
  }

  async function runPreset(key: (typeof PRESETS)[number]["key"]) {
    if (simBusy || bulkBusy) return;
    setBulkBusy(key);
    try {
      if (key === "DEVICE_OFFLINE") {
        simulateWokwiDisconnect();
        triggerAlert("DEVICE_OFFLINE");
        toast.success("Drawing Room bridge failure simulated locally.");
        return;
      }

      const targets = new Map<string, "on" | "off">();
      if (key === "AFTER_HOURS_ON") {
        devices.forEach((device) => {
          targets.set(device.deviceId, device.roomId === "work2" ? "on" : "off");
        });
      }

      if (key === "ROOM_FULLY_ON_TOO_LONG") {
        devices.forEach((device) => {
          targets.set(device.deviceId, "on");
        });
      }

      if (!backendConnected) {
        applyTargetsLocally(targets);
        triggerAlert(key);
        toast.success("Preset applied in local demo mode.");
        return;
      }

      await syncDevicesToTargets(
        targets,
        key === "AFTER_HOURS_ON"
          ? "After-hours device scenario applied."
          : "Peak occupancy scenario applied.",
      );
      triggerAlert(key);
    } catch (err: unknown) {
      toast.error(`Preset failed: ${getErrorMessage(err)}`);
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleHighUsageAlert() {
    if (simBusy || bulkBusy) return;
    setBulkBusy("HIGH_USAGE");
    try {
      if (backendConnected) {
        const targets = new Map<string, "on" | "off">(
          devices.map((device) => [device.deviceId, "on"]),
        );
        await syncDevicesToTargets(targets, "Peak load applied before alert trigger.");
      }

      triggerAlert("HIGH_USAGE");
      toast.success("High usage alert triggered.");
    } catch (err: unknown) {
      toast.error(`Alert trigger failed: ${getErrorMessage(err)}`);
    } finally {
      setBulkBusy(null);
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
          <span className="font-mono">{activeCount}</span> Active Devices · {devices.length} Total
        </span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">Operations Control Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Operator controls for validating device states, alerts, and telemetry behavior across
            the office.{" "}
            <span className="text-accent">
              Live device actions sync through the OfficePulse backend when available. Hardware
              disconnect testing remains a local operator-side simulation.
            </span>
          </p>
        </div>
        <button
          onClick={handleResetSimulation}
          disabled={simBusy || bulkBusy !== null}
          className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-4 py-2 text-sm font-semibold hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${bulkBusy === "reset" ? "animate-spin" : ""}`} />{" "}
          {bulkBusy === "reset" ? "Resetting..." : "Reset Simulation"}
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
                  disabled={simBusy || bulkBusy !== null}
                  className="group rounded-xl border border-border/40 bg-background/40 p-4 text-left transition-all hover:border-accent/40 hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p.icon className="h-5 w-5 text-accent" />
                    <span className="rounded-full border border-border/40 bg-card/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {p.key === "DEVICE_OFFLINE" ? "Local test" : "Live sync"}
                    </span>
                  </div>
                  <div className="mt-3 font-bold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.subtitle}</div>
                </button>
              ))}
            </div>
          </Panel>

          {/* Auto Simulation control */}
          <Panel icon={Zap} title="Auto Simulation">
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Auto Simulation</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono ${
                    simStatus?.autoRunning ? "text-emerald-300" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      simStatus?.autoRunning
                        ? "bg-emerald-300 animate-pulse"
                        : "bg-muted-foreground"
                    }`}
                  />
                  {simStatus ? (simStatus.autoRunning ? "ON" : "OFF") : "…"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={startAutoSimulation}
                  disabled={simBusy || bulkBusy !== null || simStatus?.autoRunning}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Auto
                </button>
                <button
                  onClick={stopAutoSimulation}
                  disabled={simBusy || bulkBusy !== null || !simStatus?.autoRunning}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop Auto
                </button>
                <button
                  onClick={triggerOneTick}
                  disabled={simBusy || bulkBusy !== null}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  One Tick
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {simStatus
                    ? `Interval ${Math.round(simStatus.intervalMs / 1000)}s · ${simStatus.totalTicks} ticks`
                    : "Backend offline"}
                </span>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Zap className="h-3 w-3" />
              Toggles a random simulator-source device (Work Room 1 or Work Room 2). Manual device
              control always works — this only drives random auto-ticking.
            </p>
          </Panel>

          {/* Device Matrix */}
          <Panel
            icon={LayoutGrid}
            title={`Device Matrix (1-${devices.length})`}
            action={
              <button
                onClick={handleRandomizeStates}
                disabled={simBusy || bulkBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Shuffle
                  className={`h-3.5 w-3.5 ${bulkBusy === "randomize" ? "animate-spin" : ""}`}
                />{" "}
                {bulkBusy === "randomize" ? "Applying..." : "Randomize Simulator"}
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {devices.map((d, i) => (
                <NodeCard
                  key={d.deviceId}
                  device={d}
                  idx={i + 1}
                  onToggle={() => toggle(d.deviceId)}
                />
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Tap any node to toggle its state. Bulk
              randomization only affects simulator-source rooms so the Drawing Room hardware bridge
              stays stable.
            </p>
          </Panel>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 min-w-0">
          <Panel icon={Sparkles} title="Control Signals">
            <div className="space-y-5">
              <SliderRow
                label="Office Activity Level"
                value={`${activity}%`}
                min={0}
                max={100}
                v={activity}
                onChange={setActivity}
              />
              <SliderRow
                label="Occupancy Level"
                value={`${occupancy}%`}
                min={0}
                max={100}
                v={occupancy}
                onChange={setOccupancy}
              />
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Simulator Mode</span>
                <span
                  className={`font-mono ${
                    backendConnected ? "text-emerald-300" : "text-muted-foreground"
                  }`}
                >
                  {backendConnected ? "Live (backend)" : "Offline (local mock)"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Hardware Bridge</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono ${wokwi ? "text-emerald-300" : "text-red-300"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${wokwi ? "bg-emerald-300" : "bg-red-300"}`}
                  />
                  {wokwi ? "Connected" : "Disconnected"}
                </span>
              </div>
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
                    className="h-full rounded-full bg-linear-to-r from-accent to-cyan-400 transition-all"
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
            <div className="relative overflow-hidden rounded-xl border border-border/40 bg-linear-to-br from-background/60 via-accent/5 to-background/60 p-6">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, oklch(0.72 0.18 165 / 0.2) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.18 165 / 0.2) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative flex flex-col items-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full border border-accent/40 bg-background/70 shadow-[0_0_30px_oklch(0.72_0.18_165/0.4)]">
                  <BrainCircuit className="h-6 w-6 text-accent" />
                </div>
                <div className="mt-4 text-sm font-bold uppercase tracking-widest text-accent">
                  Telemetry Stream Active
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Operator controls are connected to the OfficePulse backend. Simulator controls
                  validate device states, alerts, and telemetry behavior.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 w-full">
                  {Object.entries(ROOM_META).map(([id, m]) => (
                    <div
                      key={id}
                      className="rounded-lg border border-border/40 bg-background/50 p-2 text-center"
                    >
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {m.sourceLabel}
                      </div>
                      <div className="text-xs font-bold truncate">{m.name.split(" ")[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <button
            onClick={handleHighUsageAlert}
            disabled={simBusy || bulkBusy !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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

function NodeCard({
  device,
  idx,
  onToggle,
}: {
  device: Device;
  idx: number;
  onToggle: () => void;
}) {
  const on = device.status === "on";
  const Icon = device.type === "fan" ? Fan : Lightbulb;
  return (
    <button
      onClick={onToggle}
      className={`group flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
        on
          ? "border-accent/60 bg-accent/10 shadow-[0_0_25px_oklch(0.72_0.18_165/0.25)]"
          : "border-border/40 bg-background/40 hover:border-border/70"
      }`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-full ${
          on ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${on && device.type === "fan" ? "animate-spin animation-duration-[1.4s]" : ""}`}
        />
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
        {on ? "ON" : "OFF"}
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
