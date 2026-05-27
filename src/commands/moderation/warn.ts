import { getSetting } from "database/settings";
import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorCheck, modEmbed } from "embeds/modEmbed";

export const data = new SlashCommandSubcommandBuilder()
  .setName("warn")
  .setDescription("Warns a user.")
  .addUserOption(user =>
    user.setName("user").setDescription("The user that you want to warn.").setRequired(true),
  )
  .addStringOption(string => string.setName("reason").setDescription("The reason for the warn."))
  .addBooleanOption(bool =>
    bool
      .setName("silent")
      .setDescription(
        "If true, the user won't be notified about this action (overrides the server setting).",
      ),
  );

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason");
  const guild = interaction.guild;

  if (
    !guild ||
    (await errorCheck("Moderate Members", {
      interaction,
      user,
      action: "Warn",
      errorOptions: { allErrors: true, botError: false, ownerError: true, outsideError: true },
    }))
  )
    return;

  const silent =
    interaction.options.getBoolean("silent") ??
    ((await getSetting(guild.id, "moderation", "silent")) as boolean);

  await modEmbed(
    { interaction, user, action: "Warned", dm: true, dbAction: "WARN", silent },
    reason,
  );
}
