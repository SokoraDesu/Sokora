import type { Guild, User } from "discord.js";
import { mention } from "./mention";
import { randomize } from "./randomize";
import { safeMember } from "./safeThings";
import type { Mentionable, Replacements } from "./types";

const emojis =
  Math.round(Math.random() * 100) <= 5
    ? ["⌨️", "💻", "🖥️"]
    : ["💖", "💝", "💓", "💗", "💘", "💟", "💕", "💞"];

export function replace(
  text: string,
  replaceText?: { text: string; replacement: string | number }[],
): string {
  for (const mention of replaceText ?? [
    { text: "(madeWith)", replacement: `Made with ${randomize(emojis)} by the Sokora team` },
    { text: "(leftArrow)", replacement: "1298708251256291379" },
    { text: "(rightArrow)", replacement: "1298708281493160029" },
    { text: "(discord)", replacement: "1266797021126459423" },
  ])
    if (text.includes(mention.text))
      text = text.replaceAll(mention.text, mention.replacement.toString());

  return text;
}

/**
 * Takes a string with dynamic `(variables)` and replaces them with the string they represent.
 *
 * @param {string} text String to have its variables replaced.
 * @param {Guild} guild Guild.
 * @param {User} user User.
 * @returns {string} String with values replaced. The function is async because it depends on `fetchOwner()`.
 */
export async function replaceVariables(text: string, guild: Guild, user: User): Promise<string> {
  const replacementVariables: Replacements = [
    { text: "(name)", replacement: user.displayName },
    { text: "(username)", replacement: user.username },
    { text: "(count)", replacement: guild.memberCount },
    { text: "(servername)", replacement: guild.name },
    {
      text: "(serverowner)",
      replacement: (await safeMember(guild, guild.ownerId)).displayName,
    },
    { text: "(currentdate)", replacement: mention(Date.now(), "DEFAULT_TIMESTAMP") },
    { text: "(currentdate, simple)", replacement: mention(Date.now(), "SIMPLE_TIMESTAMP") },
    {
      text: "(currentdate, detailed)",
      replacement: mention(Date.now(), "DETAILED_TIMESTAMP"),
    },
  ];

  text = text.replaceAll(
    /\((\d+), (user|role|default_timestamp|simple_timestamp|detailed_timestamp|channel)\)/g,
    (_, id: string, indicator: string) => {
      return mention(id, indicator.toUpperCase() as Mentionable);
    },
  );

  return replace(text, replacementVariables);
}
