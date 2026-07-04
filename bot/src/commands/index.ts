import { helpCommand } from "./help.command.js";
import { statusCommand } from "./status.command.js";
import { roomCommand } from "./room.command.js";
import { usageCommand } from "./usage.command.js";
import { alertsCommand } from "./alerts.command.js";

export interface Command {
  name: string;
  description: string;
  execute(args: string[], raw: string): Promise<string> | string;
}

/**
 * Single source of truth for registered commands. The router iterates this list.
 * Keep this in sync with the help command output.
 */
export const commands: Command[] = [
  helpCommand,
  statusCommand,
  roomCommand,
  usageCommand,
  alertsCommand,
];

export const PREFIX = "!";
