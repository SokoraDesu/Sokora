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

interface HandlePagesOptions {
  i: ButtonInteraction;
  page: number;
  pages: number;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
}

export function pagedButtons(
  pages: number,
  argumentPage?: number,
  disabled?: boolean,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("left")
      .setEmoji(replace("(leftArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled ?? false),
    new ButtonBuilder()
      .setCustomId("pagecount")
      .setLabel(`${argumentPage ? argumentPage + 1 : 1} of ${pages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled ?? false),
    new ButtonBuilder()
      .setCustomId("right")
      .setEmoji(replace("(rightArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled ?? false),
  );
}

export async function handlePages(options: HandlePagesOptions): Promise<number> {
  const { i, page, pages, collector } = options;
  const noErrorPages = pages - 1;
  let functionPage = Math.max(0, Math.min(page, pages));
  if (i.customId == "left") return functionPage === 0 ? noErrorPages : page - 1;
  if (i.customId == "right") return functionPage === noErrorPages ? 0 : page + 1;

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

  await i.showModal(modal);
  const modalInteraction = await modalSubmit(i);
  if (!modalInteraction) return functionPage;
  collector.resetTimer({ time: 60_000 });
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
              `## You're viewing page ${functionPage + 1}.\nThis is the last page, since you went out of bounds (there aren't ${value} pages).`,
            ),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Yellow }))
      : new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## You're viewing page ${functionPage + 1}.`),
          )
          .setAccentColor(await colorize({ hue: Sokolors.Green }));

  if (value > pages)
    await safeReply({
      interaction: modalInteraction,
      replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
    });

  return functionPage;
}

/* todo: fix
export function pageContainer(options: {
  interaction: ChatInputCommandInteraction;
  reply: InteractionResponse;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
  page: number;
  pages: number;
  normalResponse: () => Promise<ContainerBuilder>;
  endResponse: () => Promise<ContainerBuilder>;
}): number {
  const { interaction, reply, collector, page, pages, normalResponse, endResponse } = options;

  let resPage: number = page.valueOf();

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    resPage = await handlePages({
      i: buttonInteraction,
      page,
      pages,
      collector,
    });

    await safeReply({
      interaction: buttonInteraction,
      editOptions: { components: [await normalResponse()] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [await endResponse()] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });

  return resPage;
}
*/
