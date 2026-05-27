import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { errorCheck, modEmbed } from "embeds/modEmbed";

export const data = new SlashCommandSubcommandBuilder()
  .setName("unban")
  .setDescription("Unbans a user.")
  .addUserOption(user =>
    user
      .setName("id")
      .setDescription("The ID of the user that you want to unban.")
      .setRequired(true),
  )
  .addStringOption(string => string.setName("reason").setDescription("The reason for the unban."));

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.options.getUser("id", true);
  const reason = interaction.options.getString("reason");

  if (
    await errorCheck("Ban Members", {
      interaction,
      user,
      action: "Unban",
      errorOptions: { allErrors: false, botError: true, ownerError: true, banCheckError: true },
    })
  )
    return;

  try {
    await Promise.all([
      modEmbed({ interaction, user, action: "Unbanned", dbAction: "UNBAN" }, reason),
      interaction.guild?.members.unban(user.id, reason ?? undefined),
    ]);
  } catch (error) {
    await errorEmbed({ interaction, error, forward: true, fileName: "unban.ts" });
  }
}
