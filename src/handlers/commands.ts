import {
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEV_IRL_TESTING_ENABLED } from "const";

type RunFunction = (interaction: ChatInputCommandInteraction) => Promise<unknown>;
interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder;
  run: RunFunction;
}

export const commands: (Command & { data: SlashCommandBuilder })[] = [];
export const subCommands: (Command & { data: Exclude<Command["data"], SlashCommandBuilder> })[] =
  [];

const commandsPath = path.join(process.cwd(), "src", "commands");

function pushCommand(array: Command[], command: Command): void {
  array.push({ data: command.data, run: command.run });
}

function pushSubCommand(run: RunFunction[], command: Command): void {
  run.push(command.run);
  pushCommand(subCommands, command);
}

async function addSubcommandGroups(
  name: string,
  subName: string,
  run: RunFunction[],
  command: SlashCommandBuilder,
): Promise<void> {
  const subCommandGroup = new SlashCommandSubcommandGroupBuilder()
    .setName(subName.toLowerCase()) // No need to remove .ts since it isn't a .ts file
    .setDescription("This subcommand group has no description.");

  const groupFiles = readdirSync(path.join(commandsPath, name, subName), {
    withFileTypes: true,
  });

  for (const subCommandGroupFile of groupFiles) {
    if (!subCommandGroupFile.isFile()) continue; // There cannot be subcommand groups of subcommand groups
    const subCommand = (await import(
      pathToFileURL(path.join(commandsPath, name, subName, subCommandGroupFile.name)).toString()
    )) as Command & { data: SlashCommandSubcommandBuilder };
    subCommandGroup.addSubcommand(subCommand.data);
    pushSubCommand(run, subCommand);
  }
  command.addSubcommandGroup(subCommandGroup);
}

async function createSubCommand(name: string): Promise<Command> {
  const run: RunFunction[] = [];
  const command = new SlashCommandBuilder()
    .setName(name.toLowerCase())
    .setDescription("This command has no description.")
    .setContexts(InteractionContextType.Guild);

  const subNames: string[] = [];
  // Base executable subcommands first, then subcommands groups
  const sortedSubFiles = readdirSync(path.join(commandsPath, name), {
    withFileTypes: true,
  }).toSorted((a, b) => {
    return a.isDirectory() == b.isDirectory()
      ? a.name.localeCompare(b.name)
      : +a.isDirectory() - +b.isDirectory();
  });

  for (const subCommandFile of sortedSubFiles) {
    const subName = subCommandFile.name;
    if (subCommandFile.isFile()) {
      const subCommand = (await import(
        pathToFileURL(path.join(commandsPath, name, subName)).toString()
      )) as Command & { data: SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder };
      if (subCommand.data instanceof SlashCommandSubcommandBuilder)
        command.addSubcommand(subCommand.data);
      else command.addSubcommandGroup(subCommand.data);

      pushSubCommand(run, subCommand);
      subNames.push(subCommand.data.name);
      continue;
    }

    // Subcommand groups
    if (subNames.includes(subName)) {
      console.error(
        `Cannot create subcommand group "${subName.toLowerCase()}" in command group "${name.toLowerCase()}": a base subcommand already exists with that name in that command group`,
      );
      continue;
    }

    await addSubcommandGroups(name, subName, run, command);
  }

  return { data: command, run: run[0] };
}

async function loadCommands(): Promise<Command[]> {
  // Base executable commands first, then commands groups
  const sortedFiles = readdirSync(commandsPath, { withFileTypes: true }).toSorted((a, b) => {
    return a.isDirectory() == b.isDirectory()
      ? a.name.localeCompare(b.name)
      : +a.isDirectory() - +b.isDirectory();
  });

  for (const commandFile of sortedFiles) {
    const name = commandFile.name;
    if (name === "test.ts" && !DEV_IRL_TESTING_ENABLED) {
      console.debug("Skipping IRL test suite.");
      continue;
    }
    if (commandFile.isFile()) {
      pushCommand(
        commands,
        (await import(pathToFileURL(path.join(commandsPath, name)).toString())) as Command,
      );
      continue;
    }
    if (commands.map(command => command.data.name).includes(name))
      console.error(
        `Cannot create command group "${name.toLowerCase()}": a base command already exists with that name`,
      );
    else pushCommand(commands, await createSubCommand(name));
  }
  console.debug("Pre-loaded commands");
  return commands;
}

export async function removeGuildCommands(client: Client): Promise<void> {
  const guilds = client.guilds.cache;
  for (const guildID of guilds.keys()) await guilds.get(guildID)?.commands.set([]);
}

export async function removeGlobalCommands(client: Client): Promise<void> {
  await client.application?.commands.set([]);
}

export async function registerGuildCommands(client: Client): Promise<void> {
  await loadCommands();
  const guilds = client.guilds.cache;

  for (const guildID of guilds.keys())
    await guilds.get(guildID)?.commands.set(commands.map(command => command.data));

  console.log("Loaded", guilds.size, "guilds");

  console.log("Loaded guild commands");
}

export async function registerGlobalCommands(client: Client): Promise<void> {
  await loadCommands();
  await client.application?.commands.set(commands.map(command => command.data));
}
