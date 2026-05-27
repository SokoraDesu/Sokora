import type { Message, TextChannel } from "discord.js";

export async function run(message: Message): Promise<void> {
  const honks = ["hnok", "hokn", "hkon", "onk", "hon", "honhk", "hhonk", "honkk"]; // discrimination is legal, honk is NOT allowed here
  if (!honks.includes(message.content.trim().toLowerCase())) return;
  await (message.channel as TextChannel).send("https://tenor.com/bW8sm.gif");
}
