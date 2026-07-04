import { useEffect, useState } from "react";
import { Bot, ExternalLink, Radio, Server } from "lucide-react";
import { discordApi } from "@/services/discordApi";
import { useOfficeStore } from "@/store/officeStore";
import type { DiscordIntegrationOverview } from "@/types";

export function DiscordBotPanel() {
  const backendConnected = useOfficeStore((s) => s.backendConnected);
  const socketConnected = useOfficeStore((s) => s.socketConnected);
  const [overview, setOverview] = useState<DiscordIntegrationOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    discordApi
      .getOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const commands = overview?.supportedCommands ?? [];

  return (
    <section className="rounded-2xl border border-border/30 bg-card/30 p-4 lg:px-6 lg:py-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Discord Bot</h3>
            <p className="text-[11px] text-muted-foreground">
              Embedded automation &amp; alert broadcasts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Server className="h-3 w-3" />
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  backendConnected ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3 w-3" />
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  socketConnected ? "bg-cyan-400" : "bg-muted-foreground"
                }`}
              />
            </span>
          </div>

          {commands.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              {commands.map((cmd) => (
                <span
                  key={cmd.name}
                  className="rounded-md border border-border/40 bg-background/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {cmd.syntax}
                </span>
              ))}
            </div>
          )}

          {overview?.inviteUrl && (
            <a
              href={overview.inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/15"
            >
              Invite Bot
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
