import { useState } from "react";
import {
  Bot,
  Leaf,
  MoonStar,
  Power,
  RotateCcw,
  Sparkles,
  Trees,
} from "lucide-react";
import { toast } from "sonner";
import { officeApi } from "@/services/officeApi";
import { useOfficeStore } from "@/store/officeStore";
import type { Device } from "@/types";

type AutomationMode = "normal" | "eco" | "night" | "vacation";

type DeviceCommand = {
  deviceId: string;
  status: "on" | "off";
};

const MODE_META: Record<
  AutomationMode,
  {
    title: string;
    subtitle: string;
    icon: typeof Power;
    activeTone: string;
    ruleLabel: string;
  }
> = {
  normal: {
    title: "Normal",
    subtitle: "Standard operation",
    icon: Power,
    activeTone: "border-indigo-400/40 bg-indigo-500/10 text-indigo-100",
    ruleLabel: "Comfort Rule",
  },
  eco: {
    title: "Eco",
    subtitle: "Reduce consumption",
    icon: Leaf,
    activeTone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    ruleLabel: "Eco Saver Rule",
  },
  night: {
    title: "Night",
    subtitle: "After-hours shutdown",
    icon: MoonStar,
    activeTone: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    ruleLabel: "After Hours Rule",
  },
  vacation: {
    title: "Vacation",
    subtitle: "Full building shutdown",
    icon: Trees,
    activeTone: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
    ruleLabel: "Shutdown Rule",
  },
};

function captureSnapshot(devices: Device[]) {
  return Object.fromEntries(
    devices.map((device) => [device.deviceId, device.status])
  ) as Record<string, Device["status"]>;
}

function buildModePlan(mode: AutomationMode, devices: Device[]): DeviceCommand[] {
  return devices
    .map((device) => {
      if (mode === "normal") {
        return { deviceId: device.deviceId, status: "on" as const };
      }

      if (mode === "eco") {
        const keepEnabled =
          device.deviceId.endsWith("fan-1") || device.deviceId.endsWith("light-1");
        return { deviceId: device.deviceId, status: keepEnabled ? "on" : "off" };
      }

      if (mode === "night") {
        return {
          deviceId: device.deviceId,
          status: device.deviceId === "drawing-light-1" ? "on" : "off",
        };
      }

      return { deviceId: device.deviceId, status: "off" };
    })
    .filter((command, index) => devices[index].status !== command.status);
}

function buildUndoPlan(
  devices: Device[],
  snapshot: Record<string, Device["status"]>
): DeviceCommand[] {
  return devices
    .map((device) => ({
      deviceId: device.deviceId,
      status: snapshot[device.deviceId] ?? device.status,
    }))
    .filter((command, index) => devices[index].status !== command.status);
}

export function SmartAutomationPanel() {
  const devices = useOfficeStore((s) => s.devices);
  const backendConnected = useOfficeStore((s) => s.backendConnected);
  const socketConnected = useOfficeStore((s) => s.socketConnected);

  const [activeMode, setActiveMode] = useState<AutomationMode>("normal");
  const [busyState, setBusyState] = useState<AutomationMode | "undo" | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<Record<string, Device["status"]> | null>(null);

  async function runCommands(
    commands: DeviceCommand[],
    nextMode: AutomationMode,
    previousSnapshot: Record<string, Device["status"]>
  ) {
    if (busyState) return;
    setBusyState(nextMode);

    let successCount = 0;
    const failures: string[] = [];

    for (const command of commands) {
      try {
        await officeApi.toggleDevice(command.deviceId, command.status);
        successCount += 1;
      } catch (error: any) {
        failures.push(error?.message ?? `Failed to update ${command.deviceId}`);
      }
    }

    if (commands.length === 0) {
      setActiveMode(nextMode);
      setLastSnapshot(previousSnapshot);
      toast.message(`${MODE_META[nextMode].title} mode is already satisfied.`);
      setBusyState(null);
      return;
    }

    if (successCount > 0) {
      setActiveMode(nextMode);
      setLastSnapshot(previousSnapshot);
    }

    if (failures.length === 0) {
      toast.success(
        `${MODE_META[nextMode].title} mode applied across ${successCount} device${
          successCount === 1 ? "" : "s"
        }.`
      );
    } else if (successCount > 0) {
      toast.warning(
        `${MODE_META[nextMode].title} applied partially (${successCount}/${commands.length}).`
      );
    } else {
      toast.error(failures[0] ?? "Automation command failed.");
    }

    setBusyState(null);
  }

  async function applyMode(mode: AutomationMode) {
    const snapshot = captureSnapshot(devices);
    const commands = buildModePlan(mode, devices);
    await runCommands(commands, mode, snapshot);
  }

  async function undoLastMode() {
    if (!lastSnapshot || busyState) return;

    const commands = buildUndoPlan(devices, lastSnapshot);
    setBusyState("undo");

    let successCount = 0;
    const failures: string[] = [];

    for (const command of commands) {
      try {
        await officeApi.toggleDevice(command.deviceId, command.status);
        successCount += 1;
      } catch (error: any) {
        failures.push(error?.message ?? `Failed to restore ${command.deviceId}`);
      }
    }

    if (successCount > 0) {
      setLastSnapshot(null);
      toast.success(`Restored ${successCount} device state${successCount === 1 ? "" : "s"}.`);
    } else if (failures.length > 0) {
      toast.error(failures[0] ?? "Undo failed.");
    }

    setBusyState(null);
  }

  return (
    <section className="rounded-[28px] border border-border/40 bg-card/40 p-5 lg:p-7 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-sky-500/20 text-sky-300">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Smart Automation</h2>
              <p className="text-sm text-muted-foreground">
                Intelligent energy management and device control
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={undoLastMode}
            disabled={!lastSnapshot || busyState !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-3 py-2 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {busyState === "undo" ? "Undoing..." : "Undo"}
          </button>
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              backendConnected && socketConnected
                ? "bg-emerald-500 text-emerald-950"
                : "border border-border/40 bg-background/40 text-muted-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {backendConnected && socketConnected ? "Active" : "Standby"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {(Object.keys(MODE_META) as AutomationMode[]).map((mode) => {
          const meta = MODE_META[mode];
          const Icon = meta.icon;
          const isActive = activeMode === mode;
          const isBusy = busyState === mode;
          return (
            <button
              key={mode}
              onClick={() => void applyMode(mode)}
              disabled={busyState !== null}
              className={`rounded-[22px] border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? meta.activeTone
                  : "border-border/40 bg-background/20 text-foreground hover:bg-background/35"
              }`}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background/35">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-semibold">{meta.title}</div>
              <div className="text-sm text-muted-foreground">
                {isBusy ? "Applying mode..." : meta.subtitle}
              </div>
            </button>
          );
        })}
      </div>

    </section>
  );
}
