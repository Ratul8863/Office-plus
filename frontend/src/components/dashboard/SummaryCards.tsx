import { Activity, AlertTriangle, Cpu, Radio, Zap } from "lucide-react";
import { useOfficeStore } from "@/store/officeStore";
import { computeUsage, formatKwh, formatWatt } from "@/utils/office";

export function SummaryCards() {
  const devices = useOfficeStore((s) => s.devices);
  const allAlerts = useOfficeStore((s) => s.alerts);
  const alerts = allAlerts.filter((a) => a.active).length;
  const wokwi = useOfficeStore((s) => s.wokwiConnected);
  const storeUsage = useOfficeStore((s) => s.usage);
  const usage = storeUsage || computeUsage(devices);

  const cards = [
    {
      label: "Total Power Now",
      value: formatWatt(usage.totalWatt),
      icon: Zap,
      tone: "text-cyan-300",
      accent: "from-cyan-500/20 to-transparent",
    },
    {
      label: "Today's Estimated Usage",
      value: formatKwh(usage.estimatedKwhToday),
      icon: Activity,
      tone: "text-emerald-300",
      accent: "from-emerald-500/20 to-transparent",
    },
    {
      label: "Active Devices",
      value: `${usage.activeDeviceCount} / 15`,
      icon: Cpu,
      tone: "text-primary",
      accent: "from-primary/20 to-transparent",
    },
    {
      label: "Active Alerts",
      value: String(alerts),
      icon: AlertTriangle,
      tone: alerts > 0 ? "text-amber-300" : "text-muted-foreground",
      accent: alerts > 0 ? "from-amber-500/20 to-transparent" : "from-muted/20 to-transparent",
    },
    {
      label: "Live Source",
      value: wokwi ? "Hardware + Sim" : "Sim Only",
      icon: Radio,
      tone: wokwi ? "text-emerald-300" : "text-destructive",
      accent: wokwi ? "from-emerald-500/20 to-transparent" : "from-destructive/20 to-transparent",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur`}
        >
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${c.accent}`} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.label}
              </div>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </div>
            <div className={`mt-3 font-mono text-2xl font-bold ${c.tone}`}>{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
