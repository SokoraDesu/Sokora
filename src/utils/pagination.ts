import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type InteractionCollector,
} from "discord.js";
import { colorize, Sokolors } from "./colorize";
import { modalSubmit } from "./modalSubmit";
import { replace } from "./replace";
import { safeReply } from "./safeThings";

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

export async function handleButtons(options: {
  i: ButtonInteraction;
  page: number;
  pages: number;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
}) {
  const { i, page, pages, collector } = options;
  const noErrPages = pages - 1;
  let returnPage = page ?? 0;

  if (i.customId == "left") returnPage = returnPage < 0 ? noErrPages : returnPage - 1;
  else if (i.customId == "right") returnPage = returnPage >= noErrPages ? 0 : returnPage + 1;
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
    if (!modalInteraction) return returnPage;
    collector.resetTimer({ time: 60000 });
    const value = modalInteraction.fields.getTextInputValue("pageinput");

    if (typeof parseInt(value) === "number") {
      // minus 1 because all these numbers revolve around arrays starting from 0.
      // thus, if a user provides 2, this hunk of code and machinery produces 1.
      const valueNum = parseInt(value) - 1;
      returnPage = valueNum < 0 ? noErrPages : valueNum >= noErrPages ? noErrPages : valueNum;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## You're viewing page ${returnPage + 1}.`),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Green }));

    await safeReply({
      interaction: modalInteraction,
      replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
    });
  }

  return returnPage;
}
