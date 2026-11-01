import { getSetting } from "database/settings";
import type { SafeChatInteraction } from "types";

/**
 * Returns whether a moderation action should be performed silently.
 *
 * @param interaction - An asserted chat interaction.
 * @returns
 */
export async function shouldModerateSilently(interaction: SafeChatInteraction): Promise<boolean> {
  const isExplicitlySilent = interaction.options.getBoolean("silent");
  return isExplicitlySilent ?? (await getSetting(interaction.guild.id, "moderation", "silent"));
}
