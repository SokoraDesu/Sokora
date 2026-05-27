import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { serverEmbed } from "embeds/serverEmbed";

export const data = new SlashCommandBuilder()
  .setName("server")
  .setDescription("Shows this server's info.")
  .setContexts(0);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const embed = await serverEmbed({ guild: interaction.guild, roles: true });
  await interaction.reply({ components: [embed], flags: "IsComponentsV2" });
}
