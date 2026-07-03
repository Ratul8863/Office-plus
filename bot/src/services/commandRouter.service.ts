import type { Message } from "discord.js";
import { BackendUnavailableError } from "../api/backendClient";
import { commands, PREFIX, Command } from "../commands";
import { logger } from "../utils/logger";

const BACKEND_DOWN_MESSAGE =
  "I can't reach the OfficePulse backend right now. Please make sure the backend server is running.";

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
  const typing = message.channel.typing;
  // Fire and forget; typing() returns a promise that resolves when typing settles.
  typing?.().catch(() => undefined);

  try {
    const reply = await cmd.execute(args, raw);
    // Discord hard-limit is 2000 chars; chunk if needed.
    await sendChunked(message, reply);
  } catch (err) {
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
  } catch (err) {
    logger.error("Failed to send Discord reply", err);
  }
}

export async function handleMessage(
  message: Message,
  opts: { channelId?: string }
): Promise<void> {
  // Ignore bots, DMs (handled by Discord itself), and ourselves
  if (message.author.bot) return;
  if (!message.guild) return;

  // Optional channel restriction
  if (opts.channelId && message.channel.id !== opts.channelId) return;

  const parsed = parse(message.content);
  if (!parsed) return;

  const cmd = commands.find((c) => c.name === parsed.name);
  if (!cmd) return; // silently ignore unknown commands

  logger.info(`!${cmd.name} invoked by ${message.author.tag} in #${message.channel.name}`);
  await executeAndReply(cmd, parsed.args, parsed.raw, message);
}
