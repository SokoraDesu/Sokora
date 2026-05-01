// [TODO] settle on a single pages code and make it
// this will be used to replace all instances of paged buttons (left arrow, go to page and right arrow buttons)
// in order to standardize the code and to
// make the code not as cluttery for bigger commands

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { replace } from "./replace";

export function pagedButtons(pages: number, argPage?: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("left")
      .setEmoji(replace("(leftArrow)"))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("pagecount")
      .setLabel(`${argPage ?? 1} of ${pages}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("right")
      .setEmoji(replace("(rightArrow)"))
      .setStyle(ButtonStyle.Primary),
  );
}
