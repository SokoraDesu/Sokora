import type { Message, TextChannel } from "discord.js";
import { multiReact } from "utils/multiReact";

export async function run(message: Message): Promise<void> {
  if (!message.content.trim().toLowerCase().includes("bread")) return;

  await (Math.round(Math.random() * 100) <= 0.25
    ? (message.channel as TextChannel).send("https://tenor.com/bOMAb.gif")
    : multiReact(message, "🍞🇧🇷🇪🇦🇩👍"));
}
