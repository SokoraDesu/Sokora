import type {
  ButtonInteraction,
  AnySelectMenuInteraction,
  Message,
  InteractionResponse,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";

/**
 * Checks buttons (or select menus) for common errors.
 * @param i The component to check.
 * @param reply The reply that will be checked against the original message.
 * @param interaction The interaction that will have its user checked against the button's interaction
 * @param checkExecutorError Makes the function check user IDs.
 * @returns An errorEmbed if something goes wrong.
 */
export async function isButtonErrory(options: {
  i: ButtonInteraction | AnySelectMenuInteraction;
  reply: Message | InteractionResponse;
  interaction?:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | AnySelectMenuInteraction;
  noExecuteError?: boolean;
}): Promise<boolean> {
  const { i, interaction, reply, noExecuteError } = options;

  if (i.customId == "please") return true;
  if (i.message.id != (await reply.fetch()).id) {
    await errorEmbed(false, {
      interaction: i,
      client: i.client,
      title:
        "For some reason, this click would’ve caused the bot to error. Thankfully, this message right here prevents that.",
    });
    return true;
  }

  if (!noExecuteError && interaction && i.user.id != interaction.user.id) {
    await errorEmbed(false, {
      interaction: i,
      client: i.client,
      title: "You are not the person who executed this command.",
    });
    return true;
  }

  return false;
}
