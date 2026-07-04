import type { Message, TextChannel, NewsChannel, ThreadChannel } from "discord.js";
import { BackendUnavailableError } from "../api/backendClient.js";
import { commands, PREFIX, Command } from "../commands/index.js";
import { logger } from "../utils/logger.js";

const BACKEND_DOWN_MESSAGE =
  "I can't reach the OfficePulse backend right now. Please make sure the backend server is running.";

type TypableChannel = TextChannel | NewsChannel | ThreadChannel;

/**
 * Splits a Discord message body like "!room work 1" into ["room", ["work 1"]].
 * Returns null when the message is not a command.
 */
function parse(content: string): { name: string; args: string[]; raw: string } | null {
  if (!content || !content.startsWith(PREFIX)) return null;
  const trimmed = content.slice(PREFIX.length).trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  const [name, ...args] = parts;
  return { name: name.toLowerCase(), args, raw: trimmed };
}

async function executeAndReply(
  cmd: Command,
  args: string[],
  raw: string,
  message: Message
): Promise<void> {
  const ch = message.channel as { sendTyping?: () => Promise<void> };
  if (typeof ch.sendTyping === "function") {
    ch.sendTyping().catch(() => undefined);
  }

  try {
    const reply = await cmd.execute(args, raw);
    // Discord hard-limit is 2000 chars; chunk if needed.
    await sendChunked(message, reply);
  } catch (err: unknown) {
    if (err instanceof BackendUnavailableError) {
      logger.warn(`Backend unavailable while running !${cmd.name}: ${err.message}`);
      await safeReply(message, BACKEND_DOWN_MESSAGE);
      return;
    }
    logger.error(`Unexpected error while running !${cmd.name}`, err);
    await safeReply(
      message,
      "Something went wrong while I was answering that. Please try again in a moment."
    );
  }
}

async function sendChunked(message: Message, text: string): Promise<void> {
  if (text.length <= 1900) {
    await safeReply(message, text);
    return;
  }
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + 1900);
    i += 1900;
    await safeReply(message, chunk);
  }
}

async function safeReply(message: Message, text: string): Promise<void> {
  try {
    await message.reply(text);
  } catch (err: unknown) {
    logger.error("Failed to send Discord reply", err);
  }
}

export async function handleMessage(
  message: Message,
  opts: { channelId?: string }
): Promise<void> {
  // Ignore bots and DMs (we only want server-channel commands).
  if (message.author.bot) return;
  if (!message.guild) return;

  // Optional channel restriction
  if (opts.channelId && message.channel.id !== opts.channelId) return;

  const parsed = parse(message.content);
  if (!parsed) return;

  const cmd = commands.find((c: Command) => c.name === parsed.name);
  if (!cmd) return; // silently ignore unknown commands

  const channelName =
    message.channel && "name" in message.channel
      ? (message.channel as { name?: string }).name ?? "unknown"
      : "DM";

  logger.info(
    `!${cmd.name} invoked by ${message.author.tag} in #${channelName}`
  );
  await executeAndReply(cmd, parsed.args, parsed.raw, message);
}

// Re-export the channel-type alias so it's not flagged as unused if tree-shaken.
export type { TypableChannel };
