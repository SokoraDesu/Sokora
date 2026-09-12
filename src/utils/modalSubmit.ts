// [TODO] figure out if there's a way to make content persist across modals

import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
} from "discord.js";
import { COLLECTOR_DURATION } from "./constants";
import { errorEmbed } from "embeds/errorEmbed";

/**
 * Collects a modal submit interaction.
 * @param interaction Either a command, a button or a select menu that triggered the modal.
 * @param modal The modal data.
 * @param fileName The file name to use in case the modal errors while trying to appear.
 * @returns The modal.
 */
export async function modalSubmit(
  interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
  modal: ModalBuilder,
  fileName?: string,
): Promise<ModalSubmitInteraction | undefined> {
  try {
    await (interaction as ButtonInteraction).showModal(modal);
  } catch (error) {
    if (fileName) await errorEmbed({ interaction, error, log: true, forward: true, fileName });
    else console.error(error);
  }

  try {
    return await interaction.awaitModalSubmit({
      time: COLLECTOR_DURATION,
      filter: m => m.user.id === interaction.user.id && m.customId === modal.data.custom_id,
    });
  } catch {
    /* In case of timeout */
  }
}
