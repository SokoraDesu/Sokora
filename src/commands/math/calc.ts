import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import * as math from "mathjs";
import { colorize, Sokolors } from "utils/colorize";

export const data = new SlashCommandSubcommandBuilder()
  .setName("calc")
  .setDescription("Calculate the result of a mathematical expression.")
  .addStringOption(option =>
    option
      .setName("expression")
      .setDescription("The mathematical expression to calculate (e.g., 'sin(pi/4)', '10*2+(6/3)')")
      .setRequired(true),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const expr = interaction.options.getString("expression", true);
  let result: unknown;

  try {
    result = math.evaluate(expr);
    if (typeof result != "number" || Number.isNaN(result) || !Number.isFinite(result))
      throw new Error("Invalid result");
  } catch (error) {
    return await errorEmbed({
      interaction,
      title: "Invalid expression.",
      reason: String(error).includes("Invalid result")
        ? `Preferably, provide expressions with a result a computer can manage (expr. \`${expr}\` gave a result above compute limit).`
        : "Please provide a valid mathematical expression. Examples: 'sin(pi/4)', '10*2+(6/3)', 'sqrt(25)'",
    });
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: "Calculation result" })
    .setDescription(`\`${expr}\` = **${result}**`)
    .setColor(await colorize({ hue: Sokolors.Blue }));

  await interaction.reply({ embeds: [embed] });
}
