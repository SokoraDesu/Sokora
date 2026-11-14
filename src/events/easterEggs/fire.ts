import type { Message, TextChannel } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (message.content.toLowerCase() != "fire in the hole") return;
  const GIFs = randomize([
    "https://tenor.com/view/dancing-gif-25178472",
    "https://klipy.com/gifs/fire-in-the-hole-3--kEoH2VHXu",
    "https://klipy.com/gifs/fire-in-the-hole-2--kEoH2VHXu",
  ]);

  await (message.channel as TextChannel).send(GIFs);
}
