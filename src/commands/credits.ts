import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { isButtonErrory } from "utils/buttonCheck";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION } from "utils/constants";
import { replace } from "utils/replace";
import { safeEdit } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("credits")
  .setDescription("Lists everyone who contributed to Sokora.")
  .setContexts(InteractionContextType.Guild);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.client.user;
  const madeWithEmoji = replace("(madeWith)");
  const color = await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple });
  let isViewingPastView = false;

  function construct(isPastView: boolean): ContainerBuilder {
    return new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Entities involved${isPastView ? " in the past" : ""}`,
        ),
        new TextDisplayBuilder().setContent(
          isPastView
            ? [
                "**Developers** • itsakuro, Kalze, Meqr, Littie, Mart *(+ translator lead)*, Pigpot, Spectrum, Sungi *(+ translator)*, **ThyTonyStank *(the reason Sokora exists!)***, underscored *(+ tester)*, Zayaan AR",
                "**Designers** • ArtyH, pibayar, proJM, Slider_on_the_black",
                "**Translators** • SaFire",
                "**Testers** • astol",
                "\n> I thank everyone that was in the team and helped shape the project into what it is today. I hope that you’ll have a bright future ahead of you.",
                String.raw`\- *Goos*`,
                "\n-# If you’re on this list and wish to remove/change your name, please contact us via contact@sokora.org",
              ].join("\n")
            : [
                "**Founder** • Goos",
                "**Developers** • Froxcey, Golem64 *(+ translator)*, Nikkerudon *(+ translator)*, ZakaHaceCosas *(+ designer, social relations, translator)*",
                "**Designers** • Pjanda, trvhz",
                "**Social relations** • Spoon",
                "**Translators** • Dimkauzh, GraczNet, TrulyBlue",
                "**Testers** • Blaze, fishy, flojo, Trynera",
                "\n> I’m grateful for everyone’s presence in the Sokora team. With every contribution and every idea, you help Sokora improve to one day be one of the best bots out there. Thank you.",
                String.raw`\- *Goos*`,
              ].join("\n"),
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("team")
            .setLabel(isPastView ? "View the current team" : "View past team members")
            .setStyle(ButtonStyle.Secondary),
        ),
      )
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${madeWithEmoji}`))
      .setAccentColor(color);
  }

  const reply = await interaction.reply({
    components: [construct(isViewingPastView)],
    flags: ["Ephemeral", "IsComponentsV2"],
  });

  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await isButtonErrory({ i: buttonInteraction, interaction, reply })) return;

    const cID = buttonInteraction.customId;
    if (cID == "please") return;
    if (cID == "team") isViewingPastView = !isViewingPastView;

    await safeEdit({
      interaction: buttonInteraction,
      editOptions: { components: [construct(isViewingPastView)] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
