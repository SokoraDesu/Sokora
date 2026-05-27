import type { Message, TextChannel } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (message.content.trim().toLowerCase() != "i'm a big fan") return;
  const GIFs = randomize([
    "https://tenor.com/bC37i.gif",
    "https://tenor.com/view/fan-gif-20757784",
    "https://tenor.com/view/below-deck-im-your-biggest-fan-biggest-fan-kate-kate-chastain-gif-15861715",
  ]);

  await (message.channel as TextChannel).send(GIFs);
}
