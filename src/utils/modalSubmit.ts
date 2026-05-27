import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";

export async function modalSubmit(
  index: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
): Promise<ModalSubmitInteraction | undefined> {
  try {
    return await index.awaitModalSubmit({
      time: 60_000,
      filter: m => m.user.id === index.user.id,
    });
  } catch {
    /* In case of timeout */
  }
}
