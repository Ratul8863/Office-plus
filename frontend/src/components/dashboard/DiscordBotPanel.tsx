import { useEffect, useState } from "react";
import { Bot, BellRing, ExternalLink, MessageSquareText, Radio, Server } from "lucide-react";
import { discordApi } from "@/services/discordApi";
import { useOfficeStore } from "@/store/officeStore";
import type { DiscordIntegrationOverview } from "@/types";

export function DiscordBotPanel() {
  const backendConnected = useOfficeStore((s) => s.backendConnected);
  const socketConnected = useOfficeStore((s) => s.socketConnected);
  const [overview, setOverview] = useState<DiscordIntegrationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setLoading(true);
        setError(null);
        const next = await discordApi.getOverview();
        if (!cancelled) {
          setOverview(next);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load Discord integration.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-[28px] border border-border/40 bg-card/40 p-5 lg:p-7 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-fuchsia-200/80">
            <Bot className="h-3.5 w-3.5 text-fuchsia-300" />
            Discord Bot
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Backend-embedded Discord automation
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Discord now boots inside the same backend deployment, so one Render service
            can serve the API, realtime events, bot commands, and alert broadcasts.
          </p>
        </div>

        {overview?.inviteUrl ? (
          <a
            href={overview.inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2.5 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/15"
          >
            Add Bot to Discord
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <StatusCard
          icon={Server}
          label="Backend"
          value={backendConnected ? "Connected" : "Disconnected"}
          tone={backendConnected ? "emerald" : "destructive"}
        />
        <StatusCard
          icon={Radio}
          label="Realtime stream"
          value={socketConnected ? "Live" : "Waiting"}
          tone={socketConnected ? "cyan" : "muted"}
        />
        <StatusCard
          icon={BellRing}
          label="Alert broadcasts"
          value={overview?.automaticAlertBroadcast ? "Enabled" : loading ? "Loading" : "Unavailable"}
          tone={overview?.automaticAlertBroadcast ? "fuchsia" : "muted"}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[24px] border border-border/40 bg-background/25 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <MessageSquareText className="h-3.5 w-3.5 text-cyan-300" />
            Command Surface
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading Discord command list...</p>
          ) : error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {overview?.supportedCommands.map((command) => (
                <div
                  key={command.name}
                  className="rounded-2xl border border-border/40 bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-mono text-sm font-semibold text-primary">
                      {command.syntax}
                    </div>
                    <div className="rounded-full border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {command.name}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{command.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-border/40 bg-background/25 p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Integration Notes
          </div>

          <div className="mt-4 space-y-3">
            {(overview?.notes ?? []).map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-sm text-foreground/90"
              >
                {note}
              </div>
            ))}

            {!loading && !error && overview ? (
              <div className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
                Invite the bot once, then use <span className="font-mono">{overview.commandPrefix}</span>
                commands from your chosen server channel to see the same live office state
                shown in OfficePulse.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  tone: "emerald" | "cyan" | "fuchsia" | "destructive" | "muted";
}) {
  const styles = {
    emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    cyan: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
    fuchsia: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    muted: "border-border/40 bg-background/30 text-muted-foreground",
  }[tone];

  return (
    <div className={`rounded-[22px] border p-4 lg:p-5 ${styles}`}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-background/40">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] opacity-80">{label}</div>
          <div className="mt-1 text-lg font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}
