import type { Message, TextChannel } from "discord.js";

export async function run(message: Message): Promise<void> {
  if (!message.content.trim().toLowerCase().includes("crazy")) return;

  await (message.channel as TextChannel).send(
    "Crazy? I was crazy once.\nThey locked me in a room.\nA rubber room.\nA rubber room with rats.\nAnd rats make me crazy.\nCrazy? I was crazy once...",
  );
}
