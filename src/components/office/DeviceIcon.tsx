import { Fan, Lightbulb } from "lucide-react";
import type { Device } from "@/types";

export function DeviceIcon({ device, size = "md" }: { device: Device; size?: "sm" | "md" | "lg" }) {
  const on = device.status === "on";
  const dims = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const box = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-16 w-16" : "h-12 w-12";

  if (device.type === "fan") {
    return (
      <div
        className={`${box} grid place-items-center rounded-full border ${
          on
            ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
            : "border-border/40 bg-muted/20 text-muted-foreground"
        }`}
      >
        <Fan className={`${dims} ${on ? "animate-spin [animation-duration:1.2s]" : ""}`} />
      </div>
    );
  }
  return (
    <div
      className={`${box} grid place-items-center rounded-full border ${
        on
          ? "border-amber-300/70 bg-amber-300/15 text-amber-200 shadow-[0_0_25px_rgba(252,211,77,0.5)]"
          : "border-border/40 bg-muted/20 text-muted-foreground"
      }`}
    >
      <Lightbulb className={dims} />
    </div>
  );
}
