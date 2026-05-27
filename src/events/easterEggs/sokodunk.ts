import type { Message, TextChannel } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (
    ![
      "sokodunk",
      "sokodunk!",
      "sike",
      "sike!",
      "sokoball",
      "sokoball!",
      "sokoballing",
      "sokoballer",
      "sokoballer!",
    ].includes(message.content.trim().toLowerCase())
  )
    return;

  await (message.channel as TextChannel).send(
    randomize([
      "https://tenor.com/view/sokora-dunk-ice-skate-ice-dunk-balling-gif-7665972654807661282?quality=lossless",
      "https://tenor.com/view/sokora-sokodunk-sokoballs-sokora-dunk-dunk-gif-9264211909049323587",
    ]),
  );
}
