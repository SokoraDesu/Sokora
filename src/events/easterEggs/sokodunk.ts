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
    randomize(["https://klipy.com/gifs/sokoballing-2", "https://klipy.com/gifs/sokoballing"]),
  );
}
