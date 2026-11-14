import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";

export const data = new SlashCommandSubcommandBuilder()
  .setName("coin")
  .setDescription("Flip a coin.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.user;
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Coin flip"),
      new TextDisplayBuilder().setContent(
        `The coin landed on **${Math.random() >= 0.5 ? "tails" : "heads"}**!`,
      ),
    )
    .setAccentColor(await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Green }));

  await interaction.reply({ components: [container], flags: "IsComponentsV2" });
}
