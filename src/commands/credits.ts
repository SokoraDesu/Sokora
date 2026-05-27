import {
  ContainerBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { replace } from "utils/replace";

export const data = new SlashCommandBuilder()
  .setName("credits")
  .setDescription("Lists everyone who contributed to Sokora.")
  .setContexts(0);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.client.user;
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Entities involved"),
      new TextDisplayBuilder().setContent(
        [
          "**Founder**: Goos",
          "**Developers**: Froxcey, Golem64, Koslz, Nikkerudon",
          "**Designer lead**: ZakaHaceCosas",
          "**Designers**: Pjanda, trvhz",
          "**Translators**: Dimkauzh, flojo, Golem64, GraczNet, Nikkerudon, SaFire, TrulyBlue, ZakaHaceCosas",
          "**Testers**: Blaze, fishy, Trynera",
        ].join("\n"),
      ),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${replace("(madeWith)")}`))
    .setAccentColor(
      await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple }),
    );

  await interaction.reply({ components: [container], flags: ["Ephemeral", "IsComponentsV2"] });
}
