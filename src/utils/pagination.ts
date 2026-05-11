import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionEditReplyOptions,
  InteractionResponse,
  LabelBuilder,
  ModalBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type InteractionCollector,
} from "discord.js";
import { buttonCheck } from "embeds/errorEmbed";
import { colorize, Sokolors } from "./colorize";
import { modalSubmit } from "./modalSubmit";
import { replace } from "./replace";
import { safeReply } from "./safeThings";

type HandlePagesOptions = {
  i: ButtonInteraction;
  page: number;
  pages: number;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
};

export function pagedButtons(pages: number, argPage?: number, disabled?: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("left")
      .setEmoji(replace("(leftArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled ?? false),
    new ButtonBuilder()
      .setCustomId("pagecount")
      .setLabel(`${argPage ? argPage + 1 : 1} of ${pages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled ?? false),
    new ButtonBuilder()
      .setCustomId("right")
      .setEmoji(replace("(rightArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled ?? false),
  );
}

export async function handlePages(options: HandlePagesOptions) {
  const { i, page, pages, collector } = options;
  const noErrPages = pages - 1;
  let funcPage = Math.max(0, Math.min(page || 0, pages) - 1);

  if (i.customId == "left") funcPage = funcPage < 0 ? noErrPages : funcPage - 1;
  else if (i.customId == "right") funcPage = funcPage >= noErrPages ? 0 : funcPage + 1;
  else if (i.customId == "pagecount") {
    const modal = new ModalBuilder()
      .setCustomId("pageselect")
      .setTitle(`•  Go to page`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Page")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("pageinput")
              .setPlaceholder("What page do you want to travel to?")
              .setStyle(TextInputStyle.Short),
          ),
      );

    await i.showModal(modal);
    const modalInteraction = await modalSubmit(i);
    if (!modalInteraction) return funcPage;
    collector.resetTimer({ time: 60000 });
    const value = modalInteraction.fields.getTextInputValue("pageinput");

    if (typeof parseInt(value) === "number") {
      // minus 1 because all these numbers revolve around arrays starting from 0.
      // thus, if a user provides 2, this hunk of code and machinery produces 1.
      const valueNum = parseInt(value) - 1;
      funcPage = valueNum < 0 ? noErrPages : valueNum >= noErrPages ? noErrPages : valueNum;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## You're viewing page ${funcPage + 1}.`),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Green }));

    await safeReply({
      interaction: modalInteraction,
      replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
    });
  }

  return funcPage;
}

export async function pageContainer(options: {
  interaction: ChatInputCommandInteraction;
  reply: InteractionResponse;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
  page: number;
  pages: number;
  normalResponse: InteractionEditReplyOptions;
  endResponse: InteractionEditReplyOptions;
}) {
  const { interaction, reply, collector, page, pages, normalResponse, endResponse } = options;
  let funcPage = Math.max(0, Math.min(page || 0, pages) - 1);

  collector.on("collect", async (i: ButtonInteraction) => {
    if (await buttonCheck({ i, interaction, reply })) return;
    collector.resetTimer({ time: 60000 });
    funcPage = await handlePages({ i, page: funcPage, pages, collector });

    await safeReply({ interaction: i, editOptions: normalResponse });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply(endResponse);
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });

  return funcPage;
}
