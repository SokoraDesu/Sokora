import { SlashCommandSubcommandBuilder } from "discord.js";
import { commands, subCommands } from "handlers/commands";
// import { noErrorsPlease } from "utils/noErrorsPlease";
import { errorEmbed } from "embeds/errorEmbed";
import type { Event } from "utils/types";
import { errorType } from "utils/errorType";

const errorRateLimit = new Set<string>();

export default (async function run(interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  const subCommand = subCommands.find(subCommand =>
    subCommand.data instanceof SlashCommandSubcommandBuilder
      ? subCommand.data.name == interaction.options.getSubcommand(false)
      : subCommand.data.name == interaction.options.getSubcommandGroup(false),
  );

  const command =
    subCommand ?? commands.find(command => command.data.name == interaction.commandName);

  if (!command) return;
  // await noErrorsPlease(interaction, command.data.name);
  try {
    await command.run(interaction);
  } catch (error) {
    const errorObj = errorType(error);
    const errorKey = `${errorObj.name}-${errorObj.message}`;
    if (errorRateLimit.has(errorKey)) return;

    errorRateLimit.add(errorKey);
    setTimeout(() => errorRateLimit.delete(errorKey), 10_000); // Is this ratelimit prevention really still necessary?
    try {
      await errorEmbed({ interaction, error, log: true, forward: true, fileName: command.data.name });
    } catch (error_) {
      console.error("Failed to send error message");
      console.error(error_);
    }
  }
} as Event<"interactionCreate">);
