import type { ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { errorType } from "./errorType";

const errorRateLimit = new Set<string>();
// eslint-disable-next-line @typescript-eslint/require-await
export async function noErrorsPlease(
  interaction: ChatInputCommandInteraction,
  fileName: string,
): Promise<void> {
  process.removeAllListeners();
  const sendErrorMessage = async (
    error: Error,
    eventType: string,
    additionalInfo = "",
  ): Promise<void> => {
    const errorKey = `${eventType}-${additionalInfo}`;
    if (errorRateLimit.has(errorKey)) return;

    errorRateLimit.add(errorKey);
    setTimeout(() => errorRateLimit.delete(errorKey), 10_000);
    try {
      await errorEmbed({ interaction, error, log: true, forward: true, fileName });
    } catch (error_) {
      console.error("Failed to send error message");
      console.error(error_);
    }
  };

  const processEventListeners: Record<
    string,
    { listener: (...arguments_: unknown[]) => Promise<void> }
  > = {
    unhandledRejection: {
      listener: async (reason, promise) => {
        await sendErrorMessage(errorType(reason), "unhandledRejection", `Promise: ${promise}`);
      },
    },
    uncaughtException: {
      listener: async (error, origin) => {
        await sendErrorMessage(errorType(error), "uncaughtException", `Origin: ${origin}`);
      },
    },
  };

  for (const [event, { listener }] of Object.entries(processEventListeners))
    process.on(event, async (...arguments_: unknown[]) => {
      try {
        await listener(...arguments_);
        return;
      } catch (error) {
        await sendErrorMessage(errorType(error), "listenerError", `Event: ${event}`);
        return;
      }
    });
}
