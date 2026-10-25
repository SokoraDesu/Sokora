import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { buildModEmbed } from "embeds/modEmbed";
import { unmute } from "features/mod/unmute";
import { assertInteraction } from "types";
import { shouldModerateSilently } from "utils/silent";

export const data = new SlashCommandSubcommandBuilder()
  .setName("unmute")
  .setDescription("Unmutes a user.")
  .addUserOption(user =>
    user.setName("user").setDescription("The user that you want to unmute.").setRequired(true),
  )
  .addStringOption(reason =>
    reason.setName("reason").setDescription("The reason for unmuting the user."),
  )
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

  const result = await unmute({
    target,
    reason,
    moderator: interaction.user,
    guild: interaction.guild,
    isSilent,
  });

  if (result.success)
    await interaction.reply({
      flags: isSilent ? ["IsComponentsV2", "Ephemeral"] : "IsComponentsV2",
      components: [await buildModEmbed(result.out)],
    });
  else {
    await errorEmbed(false, { interaction, ...result.out });
  }
  return;
}
