import type { Message, TextChannel } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (message.content.trim().toLowerCase() != "amerika ya") return;
  const response = randomize([
    "HALLO :D HALLO :D HALLO :D HALLO :D",
    "https://tenor.com/view/america-ya-gif-15374592095658975433",
  ]);

  await (message.channel as TextChannel).send(response);
}
