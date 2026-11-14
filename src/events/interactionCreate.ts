import { type Interaction, SlashCommandSubcommandBuilder } from "discord.js";
import { commands, subCommands } from "handlers/commands";
import { errorEmbed } from "embeds/errorEmbed";
import type { Event } from "types";
// import { errorType } from "utils/errorType";

// const errorRateLimit = new Set<string>();

export default (async function run(interaction: Interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  const subCommand = subCommands.find(subCommand => {
    return subCommand.data instanceof SlashCommandSubcommandBuilder
      ? subCommand.data.name == interaction.options.getSubcommand(false)
      : subCommand.data.name == interaction.options.getSubcommandGroup(false);
  });

  const command =
    subCommand ?? commands.find(command => command.data.name == interaction.commandName);

  if (!command) return;
  // await noErrorsPlease(interaction, command.data.name);
  try {
    await command.run(interaction);
  } catch (error) {
    // const errorObject = errorType(error);
    // const errorKey = `${errorObject.name}-${errorObject.message}`;
    // if (errorRateLimit.has(errorKey)) return;

    // errorRateLimit.add(errorKey);
    // setTimeout(() => errorRateLimit.delete(errorKey), 10_000); // Is this ratelimit prevention really still necessary?

    try {
      await errorEmbed(true, {
        interaction,
        error,
        fileName: command.data.name,
      });
    } catch (error_) {
      console.error("Failed to send error message");
      console.error(error_);
    }
  }
} as Event<"interactionCreate">);
