import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Clock,
  Fan,
  Gauge,
  HardDrive,
  LayoutGrid,
  Lightbulb,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  Shuffle,
  Sparkles,
  TrendingUp,
  WifiOff,
  Zap,
} from "lucide-react";
import { useOfficeStore } from "@/store/officeStore";
import { computeUsage, formatRelative, formatTime, formatWatt, ROOM_META } from "@/utils/office";
import type { ActivityEvent, AlertType, Device, RoomId } from "@/types";
import { officeApi } from "@/services/officeApi";
import { simulatorApi, type SimulatorStatus } from "@/services/simulatorApi";
import { toast } from "sonner";

export const Route = createFileRoute("/simulation")({
  component: SimulationPage,
});

const ROOM_ORDER: RoomId[] = ["drawing", "work1", "work2"];
const ROOM_CAPACITY_WATT = 2 * 60 + 3 * 15;
const SOURCE_LABEL = {
  wokwi: "Hardware queue",
  simulator: "Digital twin",
} as const;

const PRESETS = [
  {
    key: "AFTER_HOURS_ON" as const,
    title: "After-Hours Sweep",
    subtitle: "Work Room 2 stays active while the rest of the office drops to low energy mode.",
    impact: "Best for validating security + after-hours alerting behavior.",
    scope: "Live sync",
    rooms: "Work Room 2 dominant",
    icon: Clock,
    accent: "border-amber-400/30 bg-linear-to-br from-amber-500/12 via-amber-500/5 to-transparent",
    badge: "text-amber-200 border-amber-400/30 bg-amber-500/10",
  },
  {
    key: "ROOM_FULLY_ON_TOO_LONG" as const,
    title: "Peak Occupancy Surge",
    subtitle: "Drive all rooms fully active to stress the office-wide load and alert thresholds.",
    impact: "Best for validating high draw, room saturation, and peak load behavior.",
    scope: "Live sync",
    rooms: "All rooms",
    icon: Zap,
    accent: "border-cyan-400/30 bg-linear-to-br from-cyan-500/12 via-cyan-500/5 to-transparent",
    badge: "text-cyan-200 border-cyan-400/30 bg-cyan-500/10",
  },
  {
    key: "DEVICE_OFFLINE" as const,
    title: "Bridge Failure Drill",
    subtitle: "Simulate a Drawing Room bridge outage without changing real hardware state.",
    impact: "Best for operator training and UI-only outage messaging checks.",
    scope: "Local test",
    rooms: "Drawing Room",
    icon: WifiOff,
    accent: "border-rose-400/30 bg-linear-to-br from-rose-500/12 via-rose-500/5 to-transparent",
    badge: "text-rose-200 border-rose-400/30 bg-rose-500/10",
  },
] as const;

const ALERT_LABELS: Record<AlertType, string> = {
  AFTER_HOURS_ON: "After-Hours Devices ON",
  ROOM_FULLY_ON_TOO_LONG: "Room Fully ON Too Long",
  HIGH_USAGE: "High Usage Threshold",
  DEVICE_OFFLINE: "Hardware Telemetry Offline",
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function SimulationPage() {
  const devices = useOfficeStore((s) => s.devices);
  const alerts = useOfficeStore((s) => s.alerts);
  const activity = useOfficeStore((s) => s.activity);
  const toggle = useOfficeStore((s) => s.toggleDevice);
  const randomize = useOfficeStore((s) => s.randomize);
  const reset = useOfficeStore((s) => s.reset);
  const setDeviceStatus = useOfficeStore((s) => s.setDeviceStatus);
  const triggerAlert = useOfficeStore((s) => s.triggerAlert);
  const simulateWokwiDisconnect = useOfficeStore((s) => s.simulateWokwiDisconnect);
  const updateSingleDevice = useOfficeStore((s) => s.updateSingleDevice);
  const wokwi = useOfficeStore((s) => s.wokwiConnected);
  const backendConnected = useOfficeStore((s) => s.backendConnected);
  const socketConnected = useOfficeStore((s) => s.socketConnected);

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

  const storeUsage = useOfficeStore((s) => s.usage);
  const usage = useMemo(() => storeUsage || computeUsage(devices), [devices, storeUsage]);
  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.active), [alerts]);
  const simulatorDevices = useMemo(
    () => devices.filter((device) => device.source === "simulator"),
    [devices],
  );
  const loadPct = Math.min(100, Math.round((usage.totalWatt / (ROOM_CAPACITY_WATT * 3)) * 100));
  const loadLabel = loadPct > 66 ? "High" : loadPct > 33 ? "Medium" : "Low";
  const affectedRooms = ROOM_ORDER.filter((roomId) => usage.roomWatts[roomId] > 0).length;
  const latestAlert = activeAlerts[0];
  const latestActivity = activity.slice(0, 6);

  const roomSummaries = useMemo(
    () =>
      ROOM_ORDER.map((roomId) => {
        const roomDevices = devices.filter((device) => device.roomId === roomId);
        const roomAlerts = activeAlerts.filter((alert) => alert.roomId === roomId);
        const activeDevices = roomDevices.filter((device) => device.status === "on").length;
        const latestChange = roomDevices.reduce(
          (latest, device) =>
            new Date(device.lastChanged).getTime() > new Date(latest).getTime()
              ? device.lastChanged
              : latest,
          roomDevices[0]?.lastChanged ?? new Date().toISOString(),
        );

        return {
          roomId,
          meta: ROOM_META[roomId],
          devices: roomDevices,
          activeDevices,
          currentWatt: usage.roomWatts[roomId],
          loadPct: Math.min(100, Math.round((usage.roomWatts[roomId] / ROOM_CAPACITY_WATT) * 100)),
          alertCount: roomAlerts.length,
          latestChange,
        };
      }),
    [activeAlerts, devices, usage.roomWatts],
  );

  const missionStatus = useMemo(() => {
    const runningPreset = PRESETS.find((preset) => preset.key === bulkBusy);
    if (runningPreset) {
      return {
        title: `${runningPreset.title} is deploying`,
        description: runningPreset.impact,
        tone: runningPreset.badge,
      };
    }

    if (bulkBusy === "randomize") {
      return {
        title: "Simulator rooms are being shuffled",
        description:
          "Only digital-twin devices are being randomized to keep the hardware room stable.",
        tone: "text-cyan-200 border-cyan-400/30 bg-cyan-500/10",
      };
    }

    if (bulkBusy === "reset") {
      return {
        title: "System reset sequence in progress",
        description: "Auto simulation stops first, then room states return to baseline.",
        tone: "text-slate-200 border-slate-300/20 bg-slate-500/10",
      };
    }

    if (bulkBusy === "HIGH_USAGE") {
      return {
        title: "Emergency alert validation in progress",
        description: "Peak load is being forced before the high-usage alarm is raised.",
        tone: "text-rose-200 border-rose-400/30 bg-rose-500/10",
      };
    }

    if (simBusy) {
      return {
        title: "Auto simulator is synchronizing",
        description: "Waiting for backend confirmation from the random tick engine.",
        tone: "text-emerald-200 border-emerald-400/30 bg-emerald-500/10",
      };
    }

    if (!backendConnected) {
      return {
        title: "Fallback sandbox mode",
        description:
          "The backend is unavailable, so the lab keeps local-only simulation controls visible for rehearsals.",
        tone: "text-amber-200 border-amber-400/30 bg-amber-500/10",
      };
    }

    if (simStatus?.autoRunning) {
      return {
        title: "Auto simulation is live",
        description: `Random ticks are flowing every ${Math.round(
          (simStatus.intervalMs ?? 8000) / 1000,
        )}s across simulator rooms.`,
        tone: "text-emerald-200 border-emerald-400/30 bg-emerald-500/10",
      };
    }

    if (latestAlert) {
      return {
        title: ALERT_LABELS[latestAlert.type],
        description: latestAlert.message,
        tone:
          latestAlert.severity === "critical"
            ? "text-rose-200 border-rose-400/30 bg-rose-500/10"
            : "text-amber-200 border-amber-400/30 bg-amber-500/10",
      };
    }

    return {
      title: "Live validation lab ready",
      description:
        "Operator presets, auto simulation, and room control are aligned to the OfficePulse command path.",
      tone: "text-cyan-200 border-cyan-400/30 bg-cyan-500/10",
    };
  }, [backendConnected, bulkBusy, latestAlert, simBusy, simStatus]);

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

  const toggleNode = useCallback(
    async (device: Device) => {
      if (simBusy || bulkBusy) return;

      if (!backendConnected) {
        const targetStatus = device.status === "on" ? "off" : "on";
        setDeviceStatus(device.deviceId, targetStatus);
        toast.success(`${device.roomName} ${device.name} toggled in local sandbox mode.`);
        return;
      }

      await toggle(device.deviceId);
    },
    [backendConnected, bulkBusy, setDeviceStatus, simBusy, toggle],
  );

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
      <div className="text-[10px] uppercase tracking-[0.28em] text-accent/70">
        Workspace / Live Validation Lab
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-border/40 bg-card/50 p-6 shadow-glow backdrop-blur xl:p-7">
        <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-emerald-500/10" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.72 0.18 165 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.18 165 / 0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent">
                <Radio className="h-3.5 w-3.5" />
                Mission-control simulation surface
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white xl:text-5xl">
                Operations Control Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground xl:text-base">
                Run scenario missions, validate the simulator engine, and inspect the live split
                between instant digital-twin rooms and queued hardware control in Drawing Room.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill
                  icon={Server}
                  label="API link"
                  value={backendConnected ? "Live" : "Sandbox"}
                  tone={backendConnected ? "emerald" : "amber"}
                />
                <StatusPill
                  icon={Radio}
                  label="Realtime"
                  value={socketConnected ? "Streaming" : "Waiting"}
                  tone={socketConnected ? "cyan" : "slate"}
                />
                <StatusPill
                  icon={HardDrive}
                  label="Drawing bridge"
                  value={wokwi ? "Online" : "Offline"}
                  tone={wokwi ? "emerald" : "rose"}
                />
                <StatusPill
                  icon={Sparkles}
                  label="Simulation mode"
                  value={simStatus?.autoRunning ? "Auto" : "Manual"}
                  tone={simStatus?.autoRunning ? "emerald" : "slate"}
                />
              </div>
            </div>

            <div className="xl:max-w-sm xl:min-w-[320px]">
              <div className={`rounded-2xl border px-4 py-4 ${missionStatus.tone}`}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/75">
                  Current mission state
                </div>
                <div className="mt-2 text-xl font-bold text-white">{missionStatus.title}</div>
                <p className="mt-2 text-sm text-white/75">{missionStatus.description}</p>
              </div>

              <button
                onClick={handleResetSimulation}
                disabled={simBusy || bulkBusy !== null}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/40 bg-background/50 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${bulkBusy === "reset" ? "animate-spin" : ""}`} />
                {bulkBusy === "reset" ? "Resetting live state..." : "Reset Simulation"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              icon={Gauge}
              label="Live load"
              value={formatWatt(usage.totalWatt)}
              helper={`${loadLabel} pressure`}
            />
            <MetricTile
              icon={LayoutGrid}
              label="Active devices"
              value={`${usage.activeDeviceCount}/${devices.length}`}
              helper={`${affectedRooms}/3 rooms energized`}
            />
            <MetricTile
              icon={ShieldAlert}
              label="Active alerts"
              value={String(activeAlerts.length).padStart(2, "0")}
              helper={latestAlert ? ALERT_LABELS[latestAlert.type] : "No active warnings"}
            />
            <MetricTile
              icon={Activity}
              label="Auto ticks"
              value={String(simStatus?.totalTicks ?? 0).padStart(2, "0")}
              helper={
                simStatus?.autoRunning
                  ? `Every ${Math.round((simStatus.intervalMs ?? 8000) / 1000)}s`
                  : "Manual control"
              }
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <MissionRule
              title="Hardware truth"
              body="Drawing Room commands queue through MQTT first, then update after bridge confirmation."
            />
            <MissionRule
              title="Simulator truth"
              body="Work Room 1 and Work Room 2 switch instantly and also drive backend auto-ticks."
            />
            <MissionRule
              title="Operator drills"
              body="Failure drills stay clearly marked when they are local-only rehearsals instead of real backend state."
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6 min-w-0">
          <SurfaceCard
            icon={LayoutGrid}
            eyebrow="Scenario missions"
            title="Run creative validation drills"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {PRESETS.map((preset) => (
                <ScenarioMissionCard
                  key={preset.key}
                  preset={preset}
                  isBusy={bulkBusy === preset.key}
                  isActive={
                    bulkBusy === preset.key ||
                    activeAlerts.some((alert) => alert.type === preset.key) ||
                    (preset.key === "DEVICE_OFFLINE" && !wokwi)
                  }
                  disabled={simBusy || bulkBusy !== null}
                  onRun={() => runPreset(preset.key)}
                />
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            icon={Zap}
            eyebrow="Control deck"
            title="Simulator engine and emergency actions"
          >
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-emerald-400/15 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-300/70">
                      Auto simulator
                    </div>
                    <div className="mt-1 text-lg font-bold text-white">
                      {simStatus?.autoRunning ? "Random tick engine is live" : "Manual tick mode"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The backend only randomizes simulator-source devices in Work Room 1 and Work
                      Room 2.
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      simStatus?.autoRunning
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border-border/40 bg-background/50 text-muted-foreground"
                    }`}
                  >
                    {simStatus?.autoRunning ? "AUTO LIVE" : "MANUAL"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <ActionButton
                    label="Start Auto"
                    icon={Play}
                    tone="emerald"
                    disabled={simBusy || bulkBusy !== null || simStatus?.autoRunning}
                    onClick={startAutoSimulation}
                  />
                  <ActionButton
                    label="Stop Auto"
                    icon={Pause}
                    tone="amber"
                    disabled={simBusy || bulkBusy !== null || !simStatus?.autoRunning}
                    onClick={stopAutoSimulation}
                  />
                  <ActionButton
                    label="One Tick"
                    icon={Shuffle}
                    tone="cyan"
                    disabled={simBusy || bulkBusy !== null}
                    onClick={triggerOneTick}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InlineStat
                    label="Tick cadence"
                    value={
                      simStatus
                        ? `${Math.round((simStatus.intervalMs ?? 8000) / 1000)} seconds`
                        : "Backend offline"
                    }
                  />
                  <InlineStat
                    label="Total ticks"
                    value={String(simStatus?.totalTicks ?? 0).padStart(2, "0")}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">
                  Burst actions
                </div>
                <div className="mt-1 text-lg font-bold text-white">Operator trigger deck</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bulk simulator shuffling stays away from the hardware room, while emergency alert
                  validation can force a peak-load condition first.
                </p>

                <div className="mt-4 space-y-2.5">
                  <button
                    onClick={handleRandomizeStates}
                    disabled={simBusy || bulkBusy !== null}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/15 px-4 py-3 text-sm font-bold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Shuffle
                      className={`h-4 w-4 ${bulkBusy === "randomize" ? "animate-spin" : ""}`}
                    />
                    {bulkBusy === "randomize"
                      ? "Shuffling simulator rooms..."
                      : "Randomize Simulator Rooms"}
                  </button>
                  <button
                    onClick={handleHighUsageAlert}
                    disabled={simBusy || bulkBusy !== null}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {bulkBusy === "HIGH_USAGE"
                      ? "Raising high-load alarm..."
                      : "Trigger High Usage Alert"}
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-border/40 bg-card/40 p-3 text-[11px] text-muted-foreground">
                  Drawing Room still reflects the real bridge path. In sandbox mode, single-node
                  taps stay enabled locally so rehearsal flow remains smooth.
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            icon={LayoutGrid}
            eyebrow="Spatial matrix"
            title="Room-by-room simulation surface"
            action={
              <span className="rounded-full border border-border/40 bg-background/40 px-3 py-1 text-[11px] text-muted-foreground">
                3 rooms · 15 nodes
              </span>
            }
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {roomSummaries.map((room) => (
                <RoomStageCard
                  key={room.roomId}
                  room={room}
                  backendConnected={backendConnected}
                  wokwiConnected={wokwi}
                  busy={simBusy || bulkBusy !== null}
                  onToggle={toggleNode}
                />
              ))}
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6 min-w-0">
          <SurfaceCard
            icon={TrendingUp}
            eyebrow="System impact"
            title="Load, risk, and room pressure"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Office draw
                    </div>
                    <div className="mt-1 text-3xl font-bold text-white">
                      {formatWatt(usage.totalWatt)}
                    </div>
                  </div>
                  <div
                    className={`rounded-2xl border px-3 py-1 text-sm font-semibold ${
                      loadLabel === "High"
                        ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                        : loadLabel === "Medium"
                          ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {loadLabel}
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-accent via-cyan-400 to-emerald-300 transition-all"
                    style={{ width: `${Math.max(8, loadPct)}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <MiniImpact label="Rooms live" value={`${affectedRooms}/3`} />
                  <MiniImpact label="Alerts" value={String(activeAlerts.length)} />
                  <MiniImpact label="Hardware" value={wokwi ? "Up" : "Down"} />
                </div>
              </div>

              <div className="space-y-3">
                {roomSummaries.map((room) => (
                  <div
                    key={room.roomId}
                    className="rounded-2xl border border-border/40 bg-background/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{room.meta.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {room.activeDevices}/{room.devices.length} active ·{" "}
                          {SOURCE_LABEL[room.meta.source]}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-accent">
                          {formatWatt(room.currentWatt)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {room.alertCount} alert{room.alertCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/30">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-accent to-cyan-300"
                        style={{ width: `${Math.max(6, room.loadPct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            icon={BrainCircuit}
            eyebrow="Command path"
            title="Where each operator action travels"
          >
            <div className="space-y-3">
              <SignalStep
                icon={Sparkles}
                title="Console mission"
                body="Scenario cards, tick controls, and room pins all originate here."
                status="Online"
                tone="cyan"
              />
              <SignalStep
                icon={Server}
                title="Backend control plane"
                body={
                  backendConnected
                    ? "REST state sync and simulator endpoints are reachable."
                    : "Route is in sandbox mode with local-only fallback behavior."
                }
                status={backendConnected ? "Linked" : "Fallback"}
                tone={backendConnected ? "emerald" : "amber"}
              />
              <SignalStep
                icon={HardDrive}
                title="Drawing Room bridge"
                body={
                  wokwi
                    ? "Hardware room commands queue through MQTT, then echo back into the UI."
                    : "Bridge is offline, so outage drills remain visible as operator-side tests."
                }
                status={wokwi ? "Bridge online" : "Bridge offline"}
                tone={wokwi ? "emerald" : "rose"}
              />
              <SignalStep
                icon={Zap}
                title="Digital twin engine"
                body="Work Room simulator nodes can randomize immediately and also serve the auto-tick backend engine."
                status={simStatus?.autoRunning ? "Auto running" : "Manual"}
                tone={simStatus?.autoRunning ? "emerald" : "slate"}
              />
            </div>
          </SurfaceCard>

          <SurfaceCard
            icon={Activity}
            eyebrow="Live run log"
            title="Recent operator-visible events"
            action={
              <span className="rounded-full border border-border/40 bg-background/40 px-3 py-1 text-[11px] text-muted-foreground">
                {latestActivity.length} entries
              </span>
            }
          >
            <div className="space-y-3">
              {latestActivity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/40 bg-background/30 p-5 text-sm text-muted-foreground">
                  No events yet. Trigger a mission or toggle a room node to start the run log.
                </div>
              ) : (
                latestActivity.map((event) => <EventRow key={event.eventId} event={event} />)
              )}
            </div>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}

function SurfaceCard({
  icon: Icon,
  eyebrow,
  title,
  action,
  children,
}: {
  icon: typeof Fan;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border/40 bg-card/45 p-5 backdrop-blur xl:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-accent/70">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-bold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Fan;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "amber" | "cyan" | "slate";
}) {
  const toneClasses = {
    emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    cyan: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    slate: "border-border/40 bg-background/40 text-muted-foreground",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneClasses}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-white/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Fan;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{helper}</div>
    </div>
  );
}

function MissionRule({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/35 p-4">
      <div className="text-sm font-bold text-white">{title}</div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function ScenarioMissionCard({
  preset,
  isBusy,
  isActive,
  disabled,
  onRun,
}: {
  preset: (typeof PRESETS)[number];
  isBusy: boolean;
  isActive: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <button
      onClick={onRun}
      disabled={disabled}
      className={`group rounded-[24px] border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 ${preset.accent} ${
        isActive ? "shadow-glow" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-background/55 text-white">
          <preset.icon className="h-5 w-5" />
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${preset.badge}`}
        >
          {preset.scope}
        </span>
      </div>

      <div className="mt-4 text-lg font-bold text-white">
        {isBusy ? `${preset.title}...` : preset.title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{preset.subtitle}</p>

      <div className="mt-4 space-y-2 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/35 px-3 py-2">
          <span>Impact</span>
          <span className="font-semibold text-white/80">{preset.impact}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/35 px-3 py-2">
          <span>Primary zone</span>
          <span className="font-semibold text-white/80">{preset.rooms}</span>
        </div>
      </div>
    </button>
  );
}

function ActionButton({
  label,
  icon: Icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Fan;
  tone: "emerald" | "amber" | "cyan";
  disabled: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
    amber: "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
    cyan: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20",
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function MiniImpact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/30 px-2 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function RoomStageCard({
  room,
  backendConnected,
  wokwiConnected,
  busy,
  onToggle,
}: {
  room: {
    roomId: RoomId;
    meta: (typeof ROOM_META)[RoomId];
    devices: Device[];
    activeDevices: number;
    currentWatt: number;
    loadPct: number;
    alertCount: number;
    latestChange: string;
  };
  backendConnected: boolean;
  wokwiConnected: boolean;
  busy: boolean;
  onToggle: (device: Device) => Promise<void>;
}) {
  const fans = room.devices.filter((device) => device.type === "fan");
  const lights = room.devices.filter((device) => device.type === "light");
  const bridgeStatus =
    room.meta.source === "wokwi"
      ? wokwiConnected
        ? "Bridge online"
        : "Bridge offline"
      : "Twin ready";

  return (
    <div className="rounded-[24px] border border-border/40 bg-background/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent/70">
            {room.meta.sourceLabel}
          </div>
          <div className="mt-1 text-lg font-bold text-white">{room.meta.name}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{room.meta.purpose}</p>
        </div>
        <span className="rounded-full border border-border/40 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          {room.activeDevices}/{room.devices.length} active
        </span>
      </div>

      <div className="relative mt-4 aspect-[1.3/1] overflow-hidden rounded-2xl border border-accent/20 bg-linear-to-br from-background/85 via-background/70 to-accent/10">
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.72 0.18 165 / 0.14) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.18 165 / 0.14) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute inset-4 rounded-xl border border-accent/25" />
        <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-widest text-accent/60">
          {room.roomId.toUpperCase()}
        </div>
        <div className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-widest text-accent/40">
          {formatWatt(room.currentWatt)}
        </div>

        <div className="absolute top-[23%] left-[22%]">
          {fans[0] && (
            <FloorNodePin
              device={fans[0]}
              label="N01"
              disabled={busy}
              onToggle={() => onToggle(fans[0])}
            />
          )}
        </div>
        <div className="absolute top-[23%] right-[22%]">
          {fans[1] && (
            <FloorNodePin
              device={fans[1]}
              label="N02"
              disabled={busy}
              onToggle={() => onToggle(fans[1])}
            />
          )}
        </div>
        <div className="absolute bottom-[22%] left-[14%]">
          {lights[0] && (
            <FloorNodePin
              device={lights[0]}
              label="N03"
              disabled={busy}
              onToggle={() => onToggle(lights[0])}
            />
          )}
        </div>
        <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2">
          {lights[1] && (
            <FloorNodePin
              device={lights[1]}
              label="N04"
              disabled={busy}
              onToggle={() => onToggle(lights[1])}
            />
          )}
        </div>
        <div className="absolute bottom-[22%] right-[14%]">
          {lights[2] && (
            <FloorNodePin
              device={lights[2]}
              label="N05"
              disabled={busy}
              onToggle={() => onToggle(lights[2])}
            />
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniImpact label="Draw" value={formatWatt(room.currentWatt)} />
        <MiniImpact label="Alerts" value={String(room.alertCount)} />
        <MiniImpact label="Bridge" value={bridgeStatus} />
      </div>

      <div className="mt-4 rounded-xl border border-border/40 bg-card/35 px-3 py-2 text-[11px] text-muted-foreground">
        Last change {formatRelative(room.latestChange)} ·{" "}
        {backendConnected
          ? room.meta.source === "wokwi"
            ? "Hardware room actions wait for bridge echo."
            : "Simulator room actions apply immediately."
          : "Room is currently in local sandbox control."}
      </div>
    </div>
  );
}

function FloorNodePin({
  device,
  label,
  disabled,
  onToggle,
}: {
  device: Device;
  label: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  const on = device.status === "on";
  const Icon = device.type === "fan" ? Fan : Lightbulb;

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`group relative rounded-2xl border p-2 text-left transition-all ${
        on
          ? "border-accent/50 bg-accent/12 shadow-[0_0_22px_oklch(0.72_0.18_165/0.22)]"
          : "border-border/40 bg-background/55 hover:border-border/70"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {on && (
        <span className="absolute -inset-1 rounded-2xl border border-accent/30 animate-pulse" />
      )}
      <div className="relative flex items-center gap-2">
        <div
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            on ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              on && device.type === "fan" ? "animate-spin animation-duration-[1.4s]" : ""
            }`}
          />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          <div className="text-xs font-semibold text-white">{device.name}</div>
          <div
            className={`text-[10px] font-semibold ${on ? "text-accent" : "text-muted-foreground"}`}
          >
            {on ? "ON" : "OFF"}
          </div>
        </div>
      </div>
    </button>
  );
}

function SignalStep({
  icon: Icon,
  title,
  body,
  status,
  tone,
}: {
  icon: typeof Fan;
  title: string;
  body: string;
  status: string;
  tone: "emerald" | "rose" | "amber" | "cyan" | "slate";
}) {
  const toneClasses = {
    emerald: "border-emerald-400/20 bg-emerald-500/6 text-emerald-200",
    rose: "border-rose-400/20 bg-rose-500/6 text-rose-200",
    amber: "border-amber-400/20 bg-amber-500/6 text-amber-200",
    cyan: "border-cyan-400/20 bg-cyan-500/6 text-cyan-200",
    slate: "border-border/40 bg-background/35 text-muted-foreground",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-background/55">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="mt-1 text-xs leading-5 text-white/75">{body}</div>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-background/55 px-2 py-1 text-[10px] font-semibold">
          {status}
        </span>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const tone =
    event.type === "ALERT_CREATED"
      ? "border-rose-400/30 bg-rose-500/8 text-rose-200"
      : event.type === "DEVICE_CHANGED"
        ? "border-cyan-400/30 bg-cyan-500/8 text-cyan-200"
        : "border-border/40 bg-background/40 text-muted-foreground";

  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{event.message}</div>
          <div className="mt-1 text-[11px] text-white/70">
            {event.roomId ? ROOM_META[event.roomId].name : "System"} · {event.type}
          </div>
        </div>
        <div className="text-right text-[11px] font-mono text-white/60">
          <div>{formatTime(event.createdAt)}</div>
          <div className="mt-1">{formatRelative(event.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}
