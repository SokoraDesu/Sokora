import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { buildModEmbed } from "embeds/modEmbed";
import { delwarn } from "features/mod/delwarn";
import { assertInteraction } from "types";
import { shouldModerateSilently } from "utils/silent";

export const data = new SlashCommandSubcommandBuilder()
  .setName("delwarn")
  .setDescription("Removes a warning from a user.")
  .addUserOption(user => {
    return user
      .setName("user")
      .setDescription("The user that you want to free from the warning.")
      .setRequired(true);
  })
  .addNumberOption(number =>
    number.setName("id").setDescription("The id of the warn.").setRequired(true),
  )
  .addStringOption(input =>
    input.setName("reason").setDescription("The reason for removing the warning."),
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
  const warnId = interaction.options.getNumber("id", true);
  const reason = interaction.options.getString("reason");

  const result = await delwarn({
    target,
    moderator: interaction.user,
    guild: interaction.guild,
    warnId,
    reason,
    isSilent: await shouldModerateSilently(interaction),
  });

  if (result.success)
    await interaction.reply({
      flags: ["IsComponentsV2", "Ephemeral"],
      components: [await buildModEmbed(result.out)],
    });
  else {
    await errorEmbed(false, { interaction, ...result.out });
  }
  return;
}
