import { Client, GatewayIntentBits, Events } from "discord.js";
import { hasDiscordToken, loadEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { handleMessage } from "./services/commandRouter.service.js";
import { startAlertWatcher } from "./services/alertWatcher.service.js";

async function main(): Promise<void> {
  if (!hasDiscordToken()) {
    logger.error(
      "DISCORD_TOKEN is missing. Create a .env file in bot/ (copy bot/.env.example) " +
        "and paste your bot token. The bot will not start."
    );
    process.exit(1);
  }

  const env = loadEnv();
  logger.info(`Backend API URL: ${env.BACKEND_API_URL}`);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info(`Logged in as ${c.user.tag} (id=${c.user.id})`);
    startAlertWatcher(client);
  });

  client.on(Events.MessageCreate, (message) => {
    // Don't await — let the router handle its own errors/sends in the background.
    handleMessage(message, { channelId: env.DISCORD_CHANNEL_ID }).catch(
      (err: unknown) => logger.error("handleMessage crashed", err)
    );
  });

  client.on(Events.Error, (err: unknown) => {
    logger.error("Discord client error", err);
  });

  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (err: unknown) {
    logger.error("Failed to log in to Discord. Is DISCORD_TOKEN valid?", err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});
