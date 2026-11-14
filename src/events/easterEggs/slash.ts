import type { Message, TextChannel } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (
    !message.content.trim().toLowerCase().startsWith("!sokora") &&
    !message.content.trim().toLowerCase().startsWith("?sokora")
  )
    return;

  const response = randomize([
    "bro use the slash commands",
    "Sokora supports slash commands, no need for text-based commands",
  ]);

  await (message.channel as TextChannel).send(response);
}
