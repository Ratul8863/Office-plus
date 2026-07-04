import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Cpu,
  Database,
  Globe,
  Radio,
  Server,
  Sparkles,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoomId } from "@/types";
import { useOfficeStore } from "@/store/officeStore";
import { ROOM_META, computeUsage, formatKwh, formatRelative, formatWatt } from "@/utils/office";

export const Route = createFileRoute("/architecture")({
  component: ArchitecturePage,
});

type FlowKey = "control" | "telemetry" | "alerts";

type StepStatus = {
  label: string;
  className: string;
};

type LiveState = {
  backendConnected: boolean;
  socketConnected: boolean;
  wokwiConnected: boolean;
  activeAlerts: number;
};

type FlowStep = {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  inbound: string;
  outbound: string;
  why: string;
  watch: string;
  getStatus: (live: LiveState) => StepStatus;
};

type FlowDefinition = {
  title: string;
  subtitle: string;
  narrative: string;
  accent: string;
  restContracts: string[];
  liveContracts: string[];
  notes: string[];
  steps: FlowStep[];
};

const ROOM_ORDER: RoomId[] = ["drawing", "work1", "work2"];

const STATUS = {
  online: {
    label: "Online",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  synced: {
    label: "Synced",
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  },
  active: {
    label: "Active",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  warning: {
    label: "Attention",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  offline: {
    label: "Offline",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  standby: {
    label: "Standby",
    className: "border-border/60 bg-muted/40 text-muted-foreground",
  },
};

const FLOWS: Record<FlowKey, FlowDefinition> = {
  control: {
    title: "Control Loop",
    subtitle: "From UI intent to physical or simulated device change.",
    narrative:
      "A user action never jumps straight to hardware. The backend decides whether the target device belongs to the Drawing Room hardware bridge or one of the digital twin rooms, then returns the confirmed state back through a shared channel.",
    accent: "from-primary/25 via-cyan-400/10 to-transparent",
    restContracts: ["POST /api/devices/:deviceId/toggle", "GET /api/state"],
    liveContracts: ["device:changed", "office:state", "connection:status"],
    notes: [
      "Drawing Room commands are hardware-queued through the MQTT bridge.",
      "Simulator rooms are resolved directly in backend memory/state services.",
      "Frontend only reflects confirmed state coming back from backend channels.",
    ],
    steps: [
      {
        id: "dashboard-intent",
        title: "Dashboard Intent",
        icon: Globe,
        summary: "Operator flips a device from the dashboard or room view.",
        inbound: "UI toggle, room card, or command action",
        outbound: "POST /api/devices/:deviceId/toggle",
        why: "Keeps the UI thin and pushes all decision-making to one trusted place.",
        watch: "If the API is down, device control should fail fast and visibly.",
        getStatus: (live) => (live.backendConnected ? STATUS.active : STATUS.offline),
      },
      {
        id: "backend-decision",
        title: "Backend Decision",
        icon: Server,
        summary: "Node.js validates the request and chooses direct or hardware path.",
        inbound: "Device id + desired status",
        outbound: "Updated device state or hardware queue instruction",
        why: "This is the single source of truth for control logic, room ownership, and side effects.",
        watch: "A healthy backend means every client and bot sees the same truth.",
        getStatus: (live) => (live.backendConnected ? STATUS.online : STATUS.offline),
      },
      {
        id: "mqtt-bridge",
        title: "MQTT Bridge",
        icon: Waves,
        summary:
          "Drawing Room devices publish control packets through smartoffice/drawing/* topics.",
        inbound: "Hardware-queued toggle command",
        outbound: "MQTT ON/OFF payload to the ESP32 room",
        why: "It isolates the physical room behind a low-latency pub/sub edge.",
        watch: "If the bridge drops, hardware commands stop but simulator rooms can still operate.",
        getStatus: (live) => (live.wokwiConnected ? STATUS.synced : STATUS.warning),
      },
      {
        id: "hardware-room",
        title: "ESP32 Room",
        icon: Cpu,
        summary: "The physical Drawing Room executes the command and emits telemetry back.",
        inbound: "MQTT state command",
        outbound: "Fresh device telemetry + connection heartbeat",
        why: "This closes the loop so the dashboard reflects actual room state, not assumptions.",
        watch: "The hardware bridge should stay online for real-world control confidence.",
        getStatus: (live) => (live.wokwiConnected ? STATUS.online : STATUS.offline),
      },
      {
        id: "state-fanout",
        title: "State Fan-out",
        icon: Radio,
        summary: "Socket.IO pushes the confirmed state to every connected surface.",
        inbound: "Backend state update",
        outbound: "device:changed / office:state events",
        why: "Every dashboard session converges on the same state without polling loops.",
        watch: "Socket health determines how quickly the UI catches up after a change.",
        getStatus: (live) => (live.socketConnected ? STATUS.online : STATUS.warning),
      },
    ],
  },
  telemetry: {
    title: "Telemetry Loop",
    subtitle: "From room signals into live usage and historical context.",
    narrative:
      "Telemetry arrives from both the physical ESP32 setup and the simulator rooms. The backend normalizes that mixed input, enriches usage numbers, stores what matters, and streams a stable office-wide view back to the frontend.",
    accent: "from-cyan-400/20 via-primary/10 to-transparent",
    restContracts: [
      "GET /api/usage",
      "GET /api/usage/history?limit=24",
      "GET /api/activity?limit=40",
    ],
    liveContracts: ["usage:updated", "office:state", "connection:status"],
    notes: [
      "Drawing Room is the only hardware-backed room in the current topology.",
      "Work Room 1 and Work Room 2 run as simulator-driven digital twins.",
      "The usage graph and room summaries consume the same normalized backend feed.",
    ],
    steps: [
      {
        id: "signal-sources",
        title: "Signal Sources",
        icon: Cpu,
        summary: "ESP32 telemetry and simulator room updates originate from different worlds.",
        inbound: "Hardware state + digital twin state",
        outbound: "Normalized room/device updates",
        why: "OfficePulse blends real hardware and simulation without exposing that complexity to the UI.",
        watch: "A mixed topology is only trustworthy when every source is labeled and normalized.",
        getStatus: (live) => (live.wokwiConnected ? STATUS.synced : STATUS.warning),
      },
      {
        id: "backend-normalizer",
        title: "Backend Normalizer",
        icon: Server,
        summary: "Backend services convert room changes into a unified office state model.",
        inbound: "Device telemetry packets, simulator updates",
        outbound: "Usage snapshots, room totals, activity records",
        why: "Without normalization, charts and alerts would behave differently per room source.",
        watch: "This layer is what keeps real and simulated rooms comparable.",
        getStatus: (live) => (live.backendConnected ? STATUS.online : STATUS.offline),
      },
      {
        id: "persistence",
        title: "Persistence",
        icon: Database,
        summary: "MongoDB keeps usage history, alerts, and replayable operational context.",
        inbound: "Calculated usage + alert records",
        outbound: "History endpoints and longer-running analytics",
        why: "The dashboard can explain trends because history survives beyond a single socket session.",
        watch: "If persistence lags, live state may work while trend insights degrade.",
        getStatus: (live) => (live.backendConnected ? STATUS.active : STATUS.standby),
      },
      {
        id: "socket-broadcast",
        title: "Socket Broadcast",
        icon: Radio,
        summary: "The backend streams fresh usage and connection state through Socket.IO.",
        inbound: "Normalized office state",
        outbound: "usage:updated, office:state, connection:status",
        why: "Live dashboards feel instant because the server pushes deltas as soon as they happen.",
        watch: "Socket latency directly affects the perceived freshness of the command center.",
        getStatus: (live) => (live.socketConnected ? STATUS.online : STATUS.warning),
      },
      {
        id: "frontend-observer",
        title: "Frontend Observer",
        icon: Globe,
        summary: "The React app renders wattage, room status, activity, and history from one feed.",
        inbound: "REST bootstrap + socket updates",
        outbound: "Unified operator experience",
        why: "Users never need to think about which room is physical or simulated unless they want to.",
        watch: "The app should always fall back gracefully if the backend or socket drops.",
        getStatus: (live) => (live.backendConnected ? STATUS.active : STATUS.warning),
      },
    ],
  },
  alerts: {
    title: "Alerting + Bot Loop",
    subtitle: "From rule detection to operator visibility and Discord reach.",
    narrative:
      "Alerts are generated from the same shared state used by the dashboard. That means on-screen warnings, activity history, and Discord broadcasts all describe the same event instead of competing interpretations.",
    accent: "from-fuchsia-400/20 via-primary/10 to-transparent",
    restContracts: ["GET /api/alerts", "GET /api/alerts/active", "GET /api/integrations/discord"],
    liveContracts: ["alert:new", "alert:resolved", "usage:updated"],
    notes: [
      "After-hours, high-usage, and offline conditions are all evaluated from backend state.",
      "Discord is a consumer of backend truth, not a separate control plane.",
      "Active alerts should stay visible in both the sidebar counters and detail surfaces.",
    ],
    steps: [
      {
        id: "signal-review",
        title: "Signal Review",
        icon: Activity,
        summary: "Usage, device state, and connection health continuously shape the alert context.",
        inbound: "Telemetry, usage snapshots, connection heartbeat",
        outbound: "Candidate risk signals",
        why: "Alert quality depends on seeing the full office picture instead of isolated events.",
        watch: "If source signals are stale, alert confidence drops immediately.",
        getStatus: (live) => (live.backendConnected ? STATUS.active : STATUS.warning),
      },
      {
        id: "alert-engine",
        title: "Alert Engine",
        icon: AlertTriangle,
        summary: "Backend rules turn suspicious patterns into actionable warnings.",
        inbound: "Shared backend state",
        outbound: "AFTER_HOURS_ON / HIGH_USAGE / DEVICE_OFFLINE / ROOM_FULLY_ON_TOO_LONG",
        why: "One engine keeps severity, dedupe, and timing logic consistent across clients.",
        watch: "Open alerts should match what operators see in real usage and room data.",
        getStatus: (live) => (live.activeAlerts > 0 ? STATUS.warning : STATUS.active),
      },
      {
        id: "alert-history",
        title: "Alert History",
        icon: Database,
        summary: "Alerts are stored so the UI can show active, resolved, and historical context.",
        inbound: "Raised or resolved alert events",
        outbound: "GET /api/alerts and related views",
        why: "This gives the team operational memory instead of a fleeting toast notification.",
        watch: "Resolved alerts should disappear from the active count but stay auditable.",
        getStatus: (live) => (live.backendConnected ? STATUS.active : STATUS.standby),
      },
      {
        id: "dashboard-surface",
        title: "Dashboard Surface",
        icon: Globe,
        summary: "The frontend paints alert cards, counters, and recent activity in real time.",
        inbound: "alert:new / alert:resolved + REST bootstrap",
        outbound: "Visible warning context for operators",
        why: "Alert UX is where system intelligence becomes an action prompt.",
        watch: "Counter badges, cards, and feed entries should always agree with each other.",
        getStatus: (live) => (live.socketConnected ? STATUS.online : STATUS.warning),
      },
      {
        id: "discord-surface",
        title: "Discord Surface",
        icon: Bot,
        summary:
          "The Discord bot reads the same backend-backed alert context for remote awareness.",
        inbound: "Shared backend state and alert events",
        outbound: "Bot replies, alert broadcasts, integration overview",
        why: "Remote teams can react without opening the dashboard, but still trust the same source.",
        watch: "Bot messages should mirror dashboard meaning, not invent new business logic.",
        getStatus: (live) => (live.backendConnected ? STATUS.online : STATUS.standby),
      },
    ],
  },
};

function ArchitecturePage() {
  const devices = useOfficeStore((s) => s.devices);
  const alerts = useOfficeStore((s) => s.alerts);
  const activity = useOfficeStore((s) => s.activity);
  const usage = useOfficeStore((s) => s.usage);
  const backendConnected = useOfficeStore((s) => s.backendConnected);
  const socketConnected = useOfficeStore((s) => s.socketConnected);
  const wokwiConnected = useOfficeStore((s) => s.wokwiConnected);

  const [selectedFlow, setSelectedFlow] = useState<FlowKey>("control");
  const [selectedStepId, setSelectedStepId] = useState(FLOWS.control.steps[0].id);

  useEffect(() => {
    setSelectedStepId(FLOWS[selectedFlow].steps[0].id);
  }, [selectedFlow]);

  const computedUsage = useMemo(() => usage ?? computeUsage(devices), [usage, devices]);
  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.active), [alerts]);
  const liveState = useMemo<LiveState>(
    () => ({
      backendConnected,
      socketConnected,
      wokwiConnected,
      activeAlerts: activeAlerts.length,
    }),
    [activeAlerts.length, backendConnected, socketConnected, wokwiConnected],
  );

  const flow = FLOWS[selectedFlow];
  const selectedStep = flow.steps.find((step) => step.id === selectedStepId) ?? flow.steps[0];
  const lastActivity = activity[0];
  const onlineSignals = [backendConnected, socketConnected, wokwiConnected].filter(Boolean).length;
  const totalWatt = computedUsage.totalWatt || 1;

  const roomCards = ROOM_ORDER.map((roomId) => {
    const roomDevices = devices.filter((device) => device.roomId === roomId);
    const meta = ROOM_META[roomId];
    const currentWatt = computedUsage.roomWatts[roomId];
    const activeDeviceCount = roomDevices.filter((device) => device.status === "on").length;

    return {
      roomId,
      name: meta.name,
      purpose: meta.purpose,
      source: meta.sourceLabel,
      sourceTone:
        meta.source === "wokwi"
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
          : "border-primary/30 bg-primary/10 text-primary",
      currentWatt,
      share: Math.round((currentWatt / totalWatt) * 100),
      activeDeviceCount,
      totalDeviceCount: roomDevices.length,
      isOnline: meta.source === "wokwi" ? wokwiConnected : backendConnected,
    };
  });

  const metrics = [
    {
      label: "Signal health",
      value: `${onlineSignals}/3`,
      detail: "API, socket, hardware bridge",
    },
    {
      label: "Live office load",
      value: formatWatt(computedUsage.totalWatt),
      detail: `${computedUsage.activeDeviceCount} active devices`,
    },
    {
      label: "Energy today",
      value: formatKwh(computedUsage.estimatedKwhToday),
      detail: "Estimated from the current backend model",
    },
    {
      label: "Open alerts",
      value: String(activeAlerts.length),
      detail: activeAlerts[0]?.message ?? "No active alert is blocking the office right now",
    },
  ];

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <section className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-card/70 p-6 shadow-2xl backdrop-blur xl:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_35%)]" />
        <div className="absolute -right-10 top-0 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  Architecture Explorer
                </Badge>
                <Badge
                  variant="outline"
                  className={backendConnected ? STATUS.online.className : STATUS.offline.className}
                >
                  API {backendConnected ? "reachable" : "down"}
                </Badge>
                <Badge
                  variant="outline"
                  className={socketConnected ? STATUS.synced.className : STATUS.warning.className}
                >
                  Socket {socketConnected ? "streaming" : "reconnecting"}
                </Badge>
                <Badge
                  variant="outline"
                  className={wokwiConnected ? STATUS.online.className : STATUS.warning.className}
                >
                  Drawing bridge {wokwiConnected ? "online" : "offline"}
                </Badge>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  System architecture
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
                  A live map of how OfficePulse thinks, moves, and reacts
                </h1>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-foreground/80 lg:text-base">
                The frontend never talks directly to ESP32 hardware, MQTT, MongoDB, or Discord. The
                backend stays in the center as the single source of truth, then fans the same state
                out to the dashboard, history layer, and bot integrations.
              </p>
            </div>

            <Card className="w-full max-w-md border-border/50 bg-background/55 shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Latest signal
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {lastActivity ? lastActivity.message : "Waiting for live office events"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {lastActivity ? formatRelative(lastActivity.createdAt) : "No activity yet"}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="border-border/40 bg-background/45 shadow-none">
                <CardContent className="p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {metric.label}
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    {metric.value}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Tabs value={selectedFlow} onValueChange={(value) => setSelectedFlow(value as FlowKey)}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Interactive flows
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Pick a system loop and inspect each stage
            </h2>
          </div>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3 xl:w-auto">
            <TabsTrigger
              value="control"
              className="min-w-[170px] rounded-xl border border-border/50 bg-card/50 px-4 py-3 data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10"
            >
              Control loop
            </TabsTrigger>
            <TabsTrigger
              value="telemetry"
              className="min-w-[170px] rounded-xl border border-border/50 bg-card/50 px-4 py-3 data-[state=active]:border-cyan-400/40 data-[state=active]:bg-cyan-400/10"
            >
              Telemetry loop
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="min-w-[170px] rounded-xl border border-border/50 bg-card/50 px-4 py-3 data-[state=active]:border-fuchsia-400/40 data-[state=active]:bg-fuchsia-400/10"
            >
              Alerting + bot
            </TabsTrigger>
          </TabsList>
        </div>

        {(Object.keys(FLOWS) as FlowKey[]).map((flowKey) => {
          const currentFlow = FLOWS[flowKey];
          const currentStep = flowKey === selectedFlow ? selectedStep : currentFlow.steps[0];

          return (
            <TabsContent key={flowKey} value={flowKey} className="mt-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
                <Card className="overflow-hidden border-border/50 bg-card/60 shadow-none">
                  <CardHeader className={`bg-linear-to-r ${currentFlow.accent}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <CardTitle className="text-2xl">{currentFlow.title}</CardTitle>
                        <CardDescription className="text-sm text-foreground/70">
                          {currentFlow.subtitle}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-border/60 bg-background/60">
                        {currentFlow.steps.length} stages
                      </Badge>
                    </div>
                    <p className="max-w-3xl text-sm leading-7 text-foreground/80">
                      {currentFlow.narrative}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-6 p-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {currentFlow.steps.map((step, index) => {
                        const status = step.getStatus(liveState);
                        const Icon = step.icon;
                        const isSelected = step.id === currentStep.id;

                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => setSelectedStepId(step.id)}
                            className={`group relative rounded-2xl border p-4 text-left transition-all ${
                              isSelected
                                ? "border-primary/50 bg-primary/10 shadow-lg shadow-primary/10"
                                : "border-border/50 bg-background/45 hover:border-primary/30 hover:bg-background/70"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/80 text-primary">
                                <Icon className="h-5 w-5" />
                              </div>
                              <Badge variant="outline" className={status.className}>
                                {status.label}
                              </Badge>
                            </div>
                            <div className="mt-4">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                Stage {index + 1}
                              </div>
                              <div className="mt-1 text-base font-semibold text-foreground">
                                {step.title}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {step.summary}
                              </p>
                            </div>

                            {index < currentFlow.steps.length - 1 && (
                              <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 xl:flex">
                                <div className="rounded-full border border-border/50 bg-background/80 p-1 text-muted-foreground">
                                  <ArrowRight className="h-4 w-4" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card className="border-border/40 bg-background/45 shadow-none lg:col-span-2">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <CardTitle className="text-xl">{currentStep.title}</CardTitle>
                              <CardDescription className="mt-1 text-sm leading-6 text-muted-foreground">
                                {currentStep.summary}
                              </CardDescription>
                            </div>
                            <Badge
                              variant="outline"
                              className={currentStep.getStatus(liveState).className}
                            >
                              {currentStep.getStatus(liveState).label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              Inbound
                            </div>
                            <p className="mt-2 text-sm leading-6 text-foreground/90">
                              {currentStep.inbound}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              Outbound
                            </div>
                            <p className="mt-2 text-sm leading-6 text-foreground/90">
                              {currentStep.outbound}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              Why it matters
                            </div>
                            <p className="mt-2 text-sm leading-6 text-foreground/90">
                              {currentStep.why}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              What to watch
                            </div>
                            <p className="mt-2 text-sm leading-6 text-foreground/90">
                              {currentStep.watch}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-border/40 bg-background/45 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg">Contract surface</CardTitle>
                          <CardDescription>
                            This loop touches the following interfaces.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div>
                            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              REST touchpoints
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                              {currentFlow.restContracts.map((contract) => (
                                <li
                                  key={contract}
                                  className="rounded-xl border border-border/40 bg-card/60 px-3 py-2"
                                >
                                  <code>{contract}</code>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              Live signals
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                              {currentFlow.liveContracts.map((contract) => (
                                <li
                                  key={contract}
                                  className="rounded-xl border border-border/40 bg-card/60 px-3 py-2"
                                >
                                  <code>{contract}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="border-border/50 bg-card/60 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">Architecture truths</CardTitle>
                      <CardDescription>
                        The principles that keep the system understandable.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentFlow.notes.map((note) => (
                        <div
                          key={note}
                          className="rounded-2xl border border-border/40 bg-background/45 p-4 text-sm leading-6 text-foreground/85"
                        >
                          {note}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/60 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">Live connection radar</CardTitle>
                      <CardDescription>
                        Quick read of which backbone segments are healthy right now.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SignalRow
                        label="Backend API"
                        detail="Bootstrap data, command routing, alert source of truth"
                        online={backendConnected}
                      />
                      <SignalRow
                        label="Socket.IO stream"
                        detail="Pushes office:state, device:changed, usage:updated, alert:new"
                        online={socketConnected}
                      />
                      <SignalRow
                        label="Drawing Room hardware bridge"
                        detail="Physical MQTT-backed room under smartoffice/drawing/*"
                        online={wokwiConnected}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-border/50 bg-card/60 shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Room topology</CardTitle>
            <CardDescription>
              A quick read of how physical and simulated rooms contribute to live office load.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roomCards.map((room) => (
              <div
                key={room.roomId}
                className="rounded-3xl border border-border/40 bg-background/45 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold text-foreground">{room.name}</div>
                      <Badge variant="outline" className={room.sourceTone}>
                        {room.source}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          room.isOnline ? STATUS.online.className : STATUS.offline.className
                        }
                      >
                        {room.isOnline ? "reachable" : "degraded"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{room.purpose}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-xl font-bold text-foreground">
                      {formatWatt(room.currentWatt)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {room.activeDeviceCount}/{room.totalDeviceCount} active devices
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Share of current office load</span>
                    <span>{room.share}%</span>
                  </div>
                  <Progress value={room.share} className="h-2.5" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Why the backend stays central</CardTitle>
            <CardDescription>
              These guarantees make the architecture easier to scale and reason about.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PrincipleCard
              icon={Server}
              title="One source of truth"
              body="Dashboard state, alerting, room simulation, and Discord integration all read the same backend-owned view of the office."
            />
            <PrincipleCard
              icon={Waves}
              title="Hybrid room strategy"
              body="Only the Drawing Room goes through hardware MQTT today, while Work Room 1 and Work Room 2 stay simulator-backed without changing frontend behavior."
            />
            <PrincipleCard
              icon={Radio}
              title="Push-first feedback"
              body="REST bootstraps the initial screen and Socket.IO keeps the experience live without forcing the frontend to poll every subsystem."
            />
            <PrincipleCard
              icon={Bot}
              title="Shared alert semantics"
              body="A warning should mean the same thing in the dashboard, in activity history, and inside Discord replies or broadcasts."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignalRow({ label, detail, online }: { label: string; detail: string; online: boolean }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{label}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <Badge
          variant="outline"
          className={online ? STATUS.online.className : STATUS.offline.className}
        >
          {online ? "Healthy" : "Needs attention"}
        </Badge>
      </div>
    </div>
  );
}

function PrincipleCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-border/40 bg-background/45 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-semibold text-foreground">{title}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
