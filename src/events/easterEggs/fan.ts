import type { Message, TextChannel } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  // eslint-disable-next-line unicorn/string-content
  if (message.content.trim().toLowerCase() != "i'm a big fan") return;
  const GIFs = randomize([
    "https://klipy.com/gifs/im-a-big-fan-lewi--kYvgLws5R",
    "https://klipy.com/gifs/below-deck-im-your-biggest-fan-1--kYvgLws5R",
    "https://klipy.com/gifs/big-fan-im-a-fan--kYvgLws5R",
  ]);

  await (message.channel as TextChannel).send(GIFs);
}
