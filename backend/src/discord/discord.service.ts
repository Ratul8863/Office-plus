import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
} from "discord.js";
import { env } from "../config/env";
import { ROOMS } from "../config/device.config";
import { alertService, type Alert } from "../services/alert.service";
import { officeStateService } from "../services/officeState.service";
import { powerCalculatorService } from "../services/powerCalculator.service";
import {
  acceptedRoomAliases,
  resolveRoomId,
  type CanonicalRoomId,
} from "./roomName";
import {
  formatAlerts,
  formatAlertResolved,
  formatAlertTriggered,
  formatHelp,
  formatRoom,
  formatStatus,
  formatUsage,
  type RoomSummary,
} from "./formatters";

type ParsedCommand = { name: string; args: string[] } | null;

class DiscordService {
  private client: Client | null = null;
  private started = false;

  public async start(): Promise<void> {
    if (this.started) return;
    if (!env.DISCORD_TOKEN) {
      console.log("[Discord] DISCORD_TOKEN missing; embedded bot disabled.");
      return;
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    client.once(Events.ClientReady, (readyClient) => {
      console.log(`[Discord] Logged in as ${readyClient.user.tag} (id=${readyClient.user.id})`);
      this.started = true;
    });

    client.on(Events.MessageCreate, (message) => {
      void this.handleMessage(message);
    });

    client.on(Events.Error, (error) => {
      console.error("[Discord] Client error:", error);
    });

    alertService.registerCallbacks(
      (alert) => {
        if (env.DISCORD_ALERT_NOTIFICATIONS_ENABLED) {
          void this.announce(formatAlertTriggered(alert));
        }
      },
      (alert) => {
        if (env.DISCORD_ALERT_NOTIFICATIONS_ENABLED) {
          void this.announce(formatAlertResolved(alert));
        }
      }
    );

    try {
      await client.login(env.DISCORD_TOKEN);
      this.client = client;
    } catch (error) {
      console.error("[Discord] Failed to log in. Check DISCORD_TOKEN.", error);
    }
  }

  public async stop(): Promise<void> {
    if (!this.client) return;
    await this.client.destroy();
    this.client = null;
    this.started = false;
  }

  private parse(content: string): ParsedCommand {
    if (!content.startsWith(env.DISCORD_COMMAND_PREFIX)) return null;
    const trimmed = content.slice(env.DISCORD_COMMAND_PREFIX.length).trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/\s+/);
    const [name, ...args] = parts;
    return { name: name.toLowerCase(), args };
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;
    if (env.DISCORD_CHANNEL_ID && message.channel.id !== env.DISCORD_CHANNEL_ID) return;

    const parsed = this.parse(message.content);
    if (!parsed) return;

    try {
      const response = await this.executeCommand(parsed.name, parsed.args);
      if (!response) return;
      await this.sendChunked(message, response);
    } catch (error) {
      console.error(`[Discord] Command ${parsed.name} failed:`, error);
      await this.safeReply(
        message,
        "Something went wrong while I was answering that. Please try again in a moment."
      );
    }
  }

  private async executeCommand(name: string, args: string[]): Promise<string | null> {
    if (name === "help") {
      return formatHelp(env.DISCORD_COMMAND_PREFIX, acceptedRoomAliases());
    }

    if (name === "status") {
      return formatStatus({
        devices: officeStateService.getDevices(),
        usage: powerCalculatorService.getUsage(),
        alerts: alertService.getActiveAlerts(),
      });
    }

    if (name === "usage") {
      return formatUsage(powerCalculatorService.getUsage());
    }

    if (name === "alerts") {
      return formatAlerts(alertService.getActiveAlerts());
    }

    if (name === "room") {
      return this.runRoomCommand(args);
    }

    return null;
  }

  private runRoomCommand(args: string[]): string {
    const raw = args.join(" ").trim();
    if (!raw) {
      return [
        "Which room should I check?",
        `Try: \`${env.DISCORD_COMMAND_PREFIX}room drawing\`, \`${env.DISCORD_COMMAND_PREFIX}room work1\`, \`${env.DISCORD_COMMAND_PREFIX}room work room 2\`.`,
      ].join("\n");
    }

    const roomId = resolveRoomId(raw);
    if (!roomId) {
      return [
        `I don't recognize the room "${raw}".`,
        "Accepted names: drawing, drawing room, work1, work room 1, work2, work room 2.",
      ].join("\n");
    }

    const room = this.getRoomSummary(roomId);
    return formatRoom({ room, alerts: alertService.getActiveAlerts() });
  }

  private getRoomSummary(roomId: CanonicalRoomId): RoomSummary {
    const roomConfig = ROOMS.find((room) => room.roomId === roomId);
    if (!roomConfig) {
      throw new Error(`Room with ID ${roomId} not found`);
    }

    const usage = powerCalculatorService.getUsage();
    const roomUsage = usage.rooms.find((room) => room.roomId === roomId);
    const roomDevices = officeStateService.getDevices().filter((device) => device.roomId === roomId);

    return {
      roomId: roomConfig.roomId,
      roomName: roomConfig.roomName,
      source: roomConfig.source,
      totalWatt: roomUsage?.totalWatt ?? 0,
      activeDeviceCount: roomUsage?.activeDeviceCount ?? 0,
      activeFans: roomUsage?.activeFans ?? 0,
      activeLights: roomUsage?.activeLights ?? 0,
      devices: roomDevices,
    };
  }

  private async announce(text: string): Promise<void> {
    const channel = await this.getAnnouncementChannel();
    if (!channel) return;
    await channel.send(text).catch((error: unknown) => {
      console.error("[Discord] Failed to send alert announcement:", error);
    });
  }

  private isSendableChannel(
    channel: unknown
  ): channel is { isTextBased: () => boolean; send: (text: string) => Promise<unknown> } {
    if (!channel || typeof channel !== "object") return false;
    if (!("isTextBased" in channel) || !("send" in channel)) return false;
    return (
      typeof (channel as { isTextBased?: unknown }).isTextBased === "function" &&
      typeof (channel as { send?: unknown }).send === "function"
    );
  }

  private async getAnnouncementChannel(): Promise<{
    isTextBased: () => boolean;
    send: (text: string) => Promise<unknown>;
  } | null> {
    if (!this.client || !env.DISCORD_CHANNEL_ID) return null;
    const cached = this.client.channels.cache.get(env.DISCORD_CHANNEL_ID);
    const channel =
      cached ?? (await this.client.channels.fetch(env.DISCORD_CHANNEL_ID).catch(() => null));

    if (!channel) {
      console.warn(`[Discord] Channel ${env.DISCORD_CHANNEL_ID} not found for alerts.`);
      return null;
    }
    if (!this.isSendableChannel(channel) || !channel.isTextBased()) {
      console.warn(`[Discord] Channel ${env.DISCORD_CHANNEL_ID} is not text-based.`);
      return null;
    }
    return channel;
  }

  private async sendChunked(message: Message, text: string): Promise<void> {
    if (text.length <= 1900) {
      await this.safeReply(message, text);
      return;
    }

    let index = 0;
    while (index < text.length) {
      const chunk = text.slice(index, index + 1900);
      index += 1900;
      await this.safeReply(message, chunk);
    }
  }

  private async safeReply(message: Message, text: string): Promise<void> {
    await message.reply(text).catch((error) => {
      console.error("[Discord] Failed to send reply:", error);
    });
  }
}

export const discordService = new DiscordService();
