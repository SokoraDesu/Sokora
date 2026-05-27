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
  type ChatInputCommandInteraction,
  type InteractionCollector,
  type InteractionEditReplyOptions,
  type InteractionResponse,
} from "discord.js";
import { buttonCheck } from "embeds/errorEmbed";
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
  let functionPage = Math.max(0, Math.min(page || 0, pages) - 1);

  if (i.customId == "left") functionPage = functionPage < 0 ? noErrorPages : functionPage - 1;
  else if (i.customId == "right")
    functionPage = functionPage >= noErrorPages ? 0 : functionPage + 1;
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
    if (!modalInteraction) return functionPage;
    collector.resetTimer({ time: 60_000 });
    const value = modalInteraction.fields.getTextInputValue("pageinput");

    if (typeof Number.parseInt(value) === "number") {
      // minus 1 because all these numbers revolve around arrays starting from 0.
      // thus, if a user provides 2, this hunk of code and machinery produces 1.
      const valueNumber = Number.parseInt(value) - 1;
      functionPage = valueNumber < 0 ? noErrorPages : Math.min(valueNumber, noErrorPages);
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## You're viewing page ${functionPage + 1}.`),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Green }));

    await safeReply({
      interaction: modalInteraction,
      replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
    });
  }

  return functionPage;
}

export function pageContainer(options: {
  interaction: ChatInputCommandInteraction;
  reply: InteractionResponse;
  collector: InteractionCollector<ButtonInteraction | AnySelectMenuInteraction>;
  page: number;
  pages: number;
  normalResponse: InteractionEditReplyOptions;
  endResponse: InteractionEditReplyOptions;
}): number {
  const { interaction, reply, collector, page, pages, normalResponse, endResponse } = options;
  let functionPage = Math.max(0, Math.min(page || 0, pages) - 1);

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    functionPage = await handlePages({
      i: buttonInteraction,
      page: functionPage,
      pages,
      collector,
    });

    await safeReply({ interaction: buttonInteraction, editOptions: normalResponse });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply(endResponse);
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });

  return functionPage;
}
