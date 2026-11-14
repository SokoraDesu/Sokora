import type {
  ButtonInteraction,
  InteractionResponse,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  Message,
} from "discord.js";
import { COLLECTOR_DURATION } from "./constants";

type CollectedInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | AnySelectMenuInteraction
  | ModalSubmitInteraction;

export function collect<
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  I1 extends CollectedInteraction = CollectedInteraction,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  I2 extends CollectedInteraction = CollectedInteraction,
>(
  interaction: I1,
  reply: InteractionResponse | Message,
  onCollect: (
    interaction: I2,
    halt: (reason?: string) => void,
    resetTime: () => void,
  ) => Promise<void>,
  onEnd?: (_: unknown, reason: string) => Promise<void>,
  duration: number = COLLECTOR_DURATION,
): void /*InteractionCollector<I> */ {
  const collector = reply.createMessageComponentCollector({ time: duration });
  collector.on("collect", async (itr: I2) => {
    await onCollect(
      itr,
      r => {
        collector.stop(r);
      },
      () => {
        collector.resetTimer({ time: duration });
      },
    );
  });
  collector.on("end", async (_, reason) => {
    try {
      if (onEnd) await onEnd(_, reason);
      else await interaction.deleteReply();
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
  return; // collector;
}
