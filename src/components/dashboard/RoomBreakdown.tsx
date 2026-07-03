import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOfficeStore } from "@/store/officeStore";
import { computeUsage } from "@/utils/office";

export function RoomBreakdown() {
  const devices = useOfficeStore((s) => s.devices);
  const usage = computeUsage(devices);
  const data = [
    { room: "Drawing", watts: usage.roomWatts.drawing },
    { room: "Work 1", watts: usage.roomWatts.work1 },
    { room: "Work 2", watts: usage.roomWatts.work2 },
  ];
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Room-wise Power Breakdown
        </div>
        <div className="text-lg font-bold">Live watts by room</div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="room" stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} unit="W" />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="watts" fill="url(#g)" radius={[6, 6, 0, 0]} />
            <defs>
              <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0e7490" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
