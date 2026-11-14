import type { Message, TextChannel } from "discord.js";
import { mention } from "utils/mention";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (message.content.trim().toLowerCase() != mention(message.client.user.id, "USER")) return;
  const GIFs = randomize([
    "https://klipy.com/gifs/who-pinged-me-ping--kw9Sryt3A",
    "https://tenor.com/view/discord-who-pinged-me-who-pinged-me-gif-25140226",
    "https://klipy.com/gifs/undertaker-coffin-7--kw9Sryt3A",
    "https://tenor.com/view/who-pinged-me-ping-tudou-mr-potato-cat-gif-22762448",
    "https://tenor.com/view/me-when-someone-pings-me-sad-cursed-emoji-crying-gif-22784322",
    "https://klipy.com/gifs/discord-triggered-1--kiJCSJndl",
    "https://klipy.com/gifs/tense-table-smash--kseAlLP4L",
    "https://klipy.com/gifs/papich-smash--kseAlLP4L",
    "https://klipy.com/gifs/pinged--kw9Sryt3A",
    "https://klipy.com/gifs/yakuza-kiryu-58--kpkTadPGh",
  ]);

  await (message.channel as TextChannel).send(GIFs);
}
