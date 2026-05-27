import { settingsDefinition, settingsKeys } from "database/settings";
import {
  PermissionsBitField,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { settingsEmbed } from "embeds/settingsEmbed";

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure Sokora to your liking.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .setContexts(0);

for (const key of settingsKeys)
  data.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(key)
      .setDescription(settingsDefinition[key].description),
  );

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  await settingsEmbed(interaction, "server");
}
