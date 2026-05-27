import type { Message } from "discord.js";
import { safeMember } from "./safeThings";

/**
 * Reacts to a message with multiple emojis.
 * @param {Message} message Message to react to.
 * @param {string[]} emojis Emojis that will be used to react.
 */
export async function multiReact(message: Message, ...emojis: string[]): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  if (!(await safeMember(guild, message.client.user.id)).permissions.has("AddReactions")) return;

  for (const index of emojis) {
    if (typeof index == "object") {
      await message.react(index);
      continue;
    }
    for (const reaction of index) if (reaction != " ") await message.react(reaction);
  }
}
