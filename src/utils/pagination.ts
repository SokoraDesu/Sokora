import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type ContainerBuilder,
} from "discord.js";
import { replace } from "./replace";

export function pagedButtons(pages: number, argPage?: number, disabled?: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("left")
      .setEmoji(replace("(leftArrow)"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("pagecount")
      .setLabel(`${argPage ?? 1} of ${pages}`)
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
  responseFunc: EmbedBuilder | ContainerBuilder;
  row?: ActionRowBuilder<ButtonBuilder>;
}) {
  const { i, page, pages, responseFunc, row } = options;
  let returnPage = page ?? 0;
  let response = {};

  if (responseFunc instanceof EmbedBuilder)
    response = { embeds: [responseFunc], components: [row] };
  else response = { components: [responseFunc] };

  if (i.customId == "left") returnPage = returnPage < 0 ? pages - 1 : returnPage - 1;
  else if (i.customId == "right") returnPage = returnPage >= pages ? 0 : returnPage + 1;
  await i.update(response);

  return returnPage;
}
