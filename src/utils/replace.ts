import type { Guild, User } from "discord.js";
import { mention } from "./mention";
import { randomize } from "./randomize";
import { safeMember } from "./safeThings";
import type { Mentionable, Replacements } from "types";
import { MADE_WITH_EMOJI } from "./constants";

export function replace(
  text: string,
  replaceText?: { text: string; replacement: string | number }[],
): string {
  const replacements = replaceText ?? [
    {
      text: "(madeWith)",
      replacement: `Made with ${randomize(MADE_WITH_EMOJI())} by the Sokora team`,
    },
    { text: "(leftArrow)", replacement: process.env.LEFT_ARROW ?? "⬅️" },
    { text: "(rightArrow)", replacement: process.env.RIGHT_ARROW ?? "➡️" },
    {
      text: "(discord)",
      replacement: process.env.DISCORD ? `<:discord:${process.env.DISCORD}>` : "🏠",
    },
  ];
  for (const mention of replacements)
    if (text.includes(mention.text))
      text = text.replaceAll(mention.text, mention.replacement.toString());

  return text;
}

/**
 * Takes a string with dynamic `(variables)` and replaces them with the string they represent.
 * @param text - String to have its variables replaced.
 * @param guild - Guild.
 * @param user - User.
 * @returns String with values replaced. The function is async because it depends on `fetchOwner()`.
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
    (_, id: string, indicator: string) => mention(id, indicator.toUpperCase() as Mentionable),
  );

  return replace(text, replacementVariables);
}
