import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type InteractionCollector,
} from "discord.js";
import { modalSubmit } from "./modalSubmit";
import { replace } from "./replace";
import { safeReply } from "./safeThings";

export function pagedButtons(pages: number, argPage?: number, disabled?: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("left")
      .setEmoji(replace("(leftArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("pagecount")
      .setLabel(`${argPage ? argPage + 1 : 1} of ${pages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("right")
      .setEmoji(replace("(rightArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

export async function handleButtons(options: {
  i: ButtonInteraction;
  page: number;
  pages: number;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
}) {
  const { i, page, pages, collector } = options;
  let returnPage = page ?? 0;

  if (i.customId == "left") returnPage = returnPage < 0 ? pages - 1 : returnPage - 1;
  else if (i.customId == "right") returnPage = returnPage >= pages - 1 ? 0 : returnPage + 1;
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
              .setMaxLength(100)
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
      );

    await i.showModal(modal);
    const modalInteraction = await modalSubmit(i);

    // After modal interaction
    collector.resetTimer({ time: 60000 });
    if (!modalInteraction) return returnPage;
    const value = modalInteraction.fields.getTextInputValue("pageinput");
    returnPage = typeof parseInt(value) === "number" ? parseInt(value) - 1 : returnPage;

    // [TODO] make this not conflict with existing updatey thingies
    await safeReply({
      interaction: modalInteraction,
      replyOptions: { content: "yay", flags: ["Ephemeral"] },
    });
  }

  return returnPage;
}
