import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { assertInteraction } from "types";
import { shouldModerateSilently } from "utils/silent";
import { kick } from "features/mod/kick";
import { errorEmbed } from "embeds/errorEmbed";
import { modEmbed } from "embeds/modEmbed";

export const data = new SlashCommandSubcommandBuilder()
  .setName("kick")
  .setDescription("Kicks a user.")
  .addUserOption(user =>
    user.setName("user").setDescription("The user that you want to kick.").setRequired(true),
  )
  .addStringOption(string => string.setName("reason").setDescription("The reason for the kick."))
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

  const result = await kick({
    target,
    isSilent,
    reason,
    moderator: interaction.user,
    guild: interaction.guild,
  });

  return result.success
    ? await modEmbed({ ...result.out, interaction })
    : await errorEmbed(result.reason === "exception", { interaction, ...result.out });
}
