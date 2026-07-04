import { Router } from "express";
import { env } from "../config/env";

const router = Router();

router.get("/discord", (_req, res) => {
  res.json({
    success: true,
    data: {
      architecture: "embedded-backend-bot",
      inviteUrl: env.DISCORD_BOT_INVITE_URL,
      commandPrefix: env.DISCORD_COMMAND_PREFIX,
      automaticAlertBroadcast: Boolean(
        env.DISCORD_TOKEN &&
          env.DISCORD_CHANNEL_ID &&
          env.DISCORD_ALERT_NOTIFICATIONS_ENABLED
      ),
      supportedCommands: [
        {
          name: "help",
          syntax: `${env.DISCORD_COMMAND_PREFIX}help`,
          description: "Show all supported OfficePulse bot commands.",
        },
        {
          name: "status",
          syntax: `${env.DISCORD_COMMAND_PREFIX}status`,
          description: "Show office-wide live status, usage summary, and alert count.",
        },
        {
          name: "room",
          syntax: `${env.DISCORD_COMMAND_PREFIX}room <roomId>`,
          description: "Show the state of a single room such as drawing, work1, or work2.",
        },
        {
          name: "usage",
          syntax: `${env.DISCORD_COMMAND_PREFIX}usage`,
          description: "Show live watt, kWh, and per-room usage breakdown.",
        },
        {
          name: "alerts",
          syntax: `${env.DISCORD_COMMAND_PREFIX}alerts`,
          description: "List all active alerts currently tracked by the backend.",
        },
      ],
      notes: [
        "The Discord bot reads the same backend data as the dashboard.",
        "Discord now starts inside the backend process, so one deployment covers both API and bot.",
        "Set DISCORD_CHANNEL_ID in the backend env to broadcast alerts into one channel.",
      ],
    },
  });
});

export default router;
