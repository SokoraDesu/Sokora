import type { Message, TextChannel } from "discord.js";

export async function run(message: Message): Promise<void> {
  const content = message.content.trim().toLowerCase();
  if (
    content.startsWith("this has been") &&
    content.endsWith("in 100 seconds") &&
    message.content.toLowerCase() != "this has been in 100 seconds"
  )
    await (message.channel as TextChannel).send(
      "hit the like button and subscribe if you want to see more short videos like this thanks for watching and I will see you in the next one",
    );
}
