import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useOfficeStore } from "@/store/officeStore";
import { AlertTriangle, Info, Power, RefreshCw, Shuffle, WifiOff, Zap } from "lucide-react";

export const Route = createFileRoute("/simulation")({
  component: SimulationPage,
});

function SimulationPage() {
  const devices = useOfficeStore((s) => s.devices);
  const randomize = useOfficeStore((s) => s.randomize);
  const toggle = useOfficeStore((s) => s.toggleDevice);
  const triggerAlert = useOfficeStore((s) => s.triggerAlert);
  const simulateWokwiDisconnect = useOfficeStore((s) => s.simulateWokwiDisconnect);
  const reset = useOfficeStore((s) => s.reset);
  const [selected, setSelected] = useState(devices[0]?.deviceId ?? "");

  const btn = "flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-sm font-medium text-foreground/90 hover:bg-card transition-colors";

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Simulation controls
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Demo control room</h1>
        <p className="text-sm text-muted-foreground">Frontend-only mocks for demos and screenshots.</p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm text-foreground/90">
        <Info className="mt-0.5 h-4 w-4 text-primary" />
        <p>
          These controls are frontend mock controls. In production, device state will come from the backend through Socket.IO.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button className={btn} onClick={randomize}>
          <Shuffle className="h-4 w-4 text-cyan-300" /> Randomize device states
        </button>
        <button className={btn} onClick={() => triggerAlert("AFTER_HOURS_ON")}>
          <AlertTriangle className="h-4 w-4 text-amber-300" /> Trigger after-hours alert
        </button>
        <button className={btn} onClick={() => triggerAlert("ROOM_FULLY_ON_TOO_LONG")}>
          <AlertTriangle className="h-4 w-4 text-amber-300" /> Trigger room fully-ON alert
        </button>
        <button className={btn} onClick={() => triggerAlert("HIGH_USAGE")}>
          <Zap className="h-4 w-4 text-red-300" /> Trigger high usage alert
        </button>
        <button className={btn} onClick={simulateWokwiDisconnect}>
          <WifiOff className="h-4 w-4 text-red-300" /> Simulate Wokwi disconnect
        </button>
        <button className={btn} onClick={reset}>
          <RefreshCw className="h-4 w-4 text-muted-foreground" /> Reset mock state
        </button>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Toggle selected device
          </div>
          <div className="text-lg font-bold">Manual override</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.roomName} · {d.name} · {d.status.toUpperCase()}
              </option>
            ))}
          </select>
          <button onClick={() => toggle(selected)} className={btn}>
            <Power className="h-4 w-4 text-primary" /> Toggle ON/OFF
          </button>
        </div>
      </div>
    </div>
  );
}
