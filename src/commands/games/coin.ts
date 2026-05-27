import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";

export const data = new SlashCommandSubcommandBuilder()
  .setName("coin")
  .setDescription("Flip a coin.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.user;
  const avatar = user.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}Coin flip`,
      iconURL: avatar,
    })
    .setDescription(`The coin landed on **${Math.random() >= 0.5 ? "tails" : "heads"}**!`)
    .setColor(await colorize({ user, avatar, hue: Sokolors.Green }));

  await interaction.reply({ embeds: [embed] });
}
