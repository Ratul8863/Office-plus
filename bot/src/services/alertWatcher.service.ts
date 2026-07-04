import type { Client } from "discord.js";
import type { Alert } from "../api/backendClient.js";
import { getBackendClient } from "../api/backendClient.js";
import { loadEnv } from "../config/env.js";
import {
  formatAlertResolved,
  formatAlertTriggered,
} from "../formatters/alertFormatter.js";
import { logger } from "../utils/logger.js";

type TextChannelLike = {
  send: (message: string) => Promise<unknown>;
};

export interface AlertWatcherHandle {
  stop: () => void;
}

export function startAlertWatcher(client: Client): AlertWatcherHandle {
  const env = loadEnv();

  if (!env.DISCORD_ALERT_NOTIFICATIONS_ENABLED) {
    logger.info("[alerts] Discord alert watcher disabled by env flag");
    return { stop: () => undefined };
  }

  if (!env.DISCORD_CHANNEL_ID) {
    logger.info("[alerts] No DISCORD_CHANNEL_ID configured; alert watcher skipped");
    return { stop: () => undefined };
  }

  const knownStatuses = new Map<string, Alert["status"]>();
  let initialSyncDone = false;
  let polling = false;
  let timer: NodeJS.Timeout | null = null;

  function isSendableChannel(channel: unknown): channel is TextChannelLike {
    if (!channel || typeof channel !== "object") return false;
    if (!("send" in channel)) return false;
    return typeof (channel as { send?: unknown }).send === "function";
  }

  async function resolveChannel(): Promise<TextChannelLike | null> {
    const cached = client.channels.cache.get(env.DISCORD_CHANNEL_ID!);
    const channel = cached ?? (await client.channels.fetch(env.DISCORD_CHANNEL_ID!).catch(() => null));
    if (!channel) {
      logger.warn(`[alerts] Discord channel ${env.DISCORD_CHANNEL_ID} not found`);
      return null;
    }
    if (!channel.isTextBased() || !isSendableChannel(channel)) {
      logger.warn(`[alerts] Discord channel ${env.DISCORD_CHANNEL_ID} is not text-based`);
      return null;
    }
    return channel;
  }

  async function announce(channel: TextChannelLike, message: string): Promise<void> {
    try {
      await channel.send(message);
    } catch (err: unknown) {
      logger.error("[alerts] Failed to send Discord alert notification", err);
    }
  }

  async function syncAlerts(): Promise<void> {
    if (polling) return;
    polling = true;

    try {
      const alerts = await getBackendClient().getAlerts();

      if (!initialSyncDone) {
        for (const alert of alerts) {
          knownStatuses.set(alert.id, alert.status);
        }
        initialSyncDone = true;
        logger.info(`[alerts] Seeded ${alerts.length} existing alert(s) without broadcasting`);
        return;
      }

      const channel = await resolveChannel();
      if (!channel) return;

      const nextStatuses = new Map<string, Alert["status"]>();
      for (const alert of alerts) {
        nextStatuses.set(alert.id, alert.status);

        const previousStatus = knownStatuses.get(alert.id);
        if (!previousStatus && alert.status === "active") {
          await announce(channel, formatAlertTriggered(alert));
          continue;
        }
        if (previousStatus === "active" && alert.status === "resolved") {
          await announce(channel, formatAlertResolved(alert));
        }
      }

      knownStatuses.clear();
      for (const [id, status] of nextStatuses) {
        knownStatuses.set(id, status);
      }
    } catch (err: unknown) {
      logger.warn(
        `[alerts] Backend polling failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      polling = false;
    }
  }

  void syncAlerts();
  timer = setInterval(() => {
    void syncAlerts();
  }, env.ALERT_POLL_INTERVAL_MS);

  logger.info(
    `[alerts] Watching backend alerts every ${env.ALERT_POLL_INTERVAL_MS}ms for channel ${env.DISCORD_CHANNEL_ID}`
  );

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
