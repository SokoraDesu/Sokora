import { type ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { buildModEmbed } from "embeds/modEmbed";
import { unban } from "features/mod/unban";
import { assertInteraction } from "types";
import { shouldModerateSilently } from "utils/silent";

export const data = new SlashCommandSubcommandBuilder()
  .setName("unban")
  .setDescription("Unbans a user.")
  .addUserOption(user => {
    return user
      .setName("id")
      .setDescription("The ID of the user that you want to unban.")
      .setRequired(true);
  })
  .addStringOption(string => string.setName("reason").setDescription("The reason for the unban."));

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const target = interaction.options.getUser("id", true);
  const reason = interaction.options.getString("reason");

  const isSilent = await shouldModerateSilently(interaction);

  const result = await unban({
    target,
    isSilent,
    guild: interaction.guild,
    moderator: interaction.user,
    reason,
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
