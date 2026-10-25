import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { modEmbed } from "embeds/modEmbed";
import { warn } from "features/mod/warn";
import { assertInteraction } from "types";
import { shouldModerateSilently } from "utils/silent";

export const data = new SlashCommandSubcommandBuilder()
  .setName("warn")
  .setDescription("Warns a user.")
  .addUserOption(user =>
    user.setName("user").setDescription("The user that you want to warn.").setRequired(true),
  )
  .addStringOption(string => string.setName("reason").setDescription("The reason for the warn."))
  .addBooleanOption(bool => {
    return bool
      .setName("silent")
      .setDescription(
        "If true, the user won’t be notified about this action (overrides the server setting).",
      );
  });

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason");

  const isSilent = await shouldModerateSilently(interaction);

  const result = await warn({
    target,
    reason,
    moderator: interaction.user,
    guild: interaction.guild,
    isSilent,
  });
  return result.success
    ? await modEmbed({ ...result.out, interaction })
    : await errorEmbed(result.reason === "exception", { interaction, ...result.out });
}
