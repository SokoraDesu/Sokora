import { settingsDefinition, settingsKeys } from "database/userSettings";
import {
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { settingsEmbed } from "embeds/settingsEmbed";

export const data = new SlashCommandSubcommandGroupBuilder()
  .setName("settings")
  .setDescription("Configure Sokora to your liking.");

for (const key of settingsKeys)
  data.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(key)
      .setDescription(settingsDefinition[key].description),
  );

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  await settingsEmbed(interaction, "user");
}
