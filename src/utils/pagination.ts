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
import { COLLECTOR_DURATION } from "./constants";
import { replace } from "./replace";
import { safeReply } from "./safeThings";
import { modalSubmit } from "./modalSubmit";

interface HandlePagesOptions {
  i: ButtonInteraction;
  page: number;
  pages: number;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
}

/**
 * Pagination buttons.
 * Includes: button to go left, button to jump to a page (modal!), button to go right.
 * @param pages Total amount of pages.
 * @param argumentPage Page to skip to.
 * @param isDisabled Disables the buttons if true.
 * @returns Action row containing the pagination buttons.
 */
export function pagedButtons(
  pages: number,
  argumentPage?: number,
  isDisabled?: boolean,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("left")
      .setEmoji(replace("(leftArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isDisabled ?? false),
    new ButtonBuilder()
      .setCustomId("pagecount")
      .setLabel(`${argumentPage ? argumentPage + 1 : 1} of ${pages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isDisabled ?? false),
    new ButtonBuilder()
      .setCustomId("right")
      .setEmoji(replace("(rightArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isDisabled ?? false),
  );
}

/**
 * Function that handles page switching.
 * Notes: requires a collector. Pages start from 0.
 * @param options Options.
 * @returns The resulting page.
 */
export async function handlePages(options: HandlePagesOptions): Promise<number> {
  const { i, page, pages, collector } = options;
  const noErrorPages = pages - 1;
  let functionPage = Math.max(0, Math.min(page, pages));

  if (i.customId == "left") return functionPage === 0 ? noErrorPages : page - 1;
  if (i.customId == "right") return functionPage === noErrorPages ? 0 : page + 1;
  if (i.customId == "category") return 0;

  const modal = new ModalBuilder()
    .setCustomId("page_select")
    .setTitle(`•  Go to page`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Page")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("page_input")
            .setPlaceholder("What page do you want to travel to?")
            .setStyle(TextInputStyle.Short),
        ),
    );

  const modalInteraction = await modalSubmit(i, modal, "pagination");
  if (!modalInteraction) return functionPage;
  collector.resetTimer({ time: COLLECTOR_DURATION });

  const value = Number.parseInt(modalInteraction.fields.getTextInputValue("page_input"));
  if (!Number.isNaN(value)) {
    // minus 1 because all these numbers revolve around arrays starting from 0.
    // thus, if a user provides 2, this hunk of code and machinery produces 1.
    const valueNumber = value - 1;
    functionPage = valueNumber < 0 ? noErrorPages : Math.min(valueNumber, noErrorPages);
  }

  const container =
    value > pages
      ? new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## You’re viewing page ${functionPage + 1}.\nThis is the last page, since you went out of bounds (there aren’t ${value} pages).`,
            ),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Yellow }))
      : new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## You’re viewing page ${functionPage + 1}.`),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  await safeReply({
    interaction: modalInteraction,
    replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
  });

  return functionPage;
}
