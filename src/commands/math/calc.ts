import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { calc } from "features/math/calc";
import { colorize, Sokolors } from "utils/colorize";

export const data = new SlashCommandSubcommandBuilder()
  .setName("calc")
  .setDescription("Calculate the result of a mathematical expression.")
  .addStringOption(option => {
    return option
      .setName("expression")
      .setDescription("The mathematical expression to calculate (e.g., ’sin(pi/4)’, ’10*2+(6/3)’)")
      .setRequired(true);
  });

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const expression = interaction.options.getString("expression", true);
  const result = await calc({ expression });

  if (!result.success)
    return await errorEmbed(false, {
      interaction,
      ...result.out,
    });

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Calculation result"),
      new TextDisplayBuilder().setContent(`\`${expression}\` = **${result.out}**`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  await interaction.reply({ components: [container], flags: "IsComponentsV2" });
}
