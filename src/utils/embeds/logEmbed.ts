import {
  ContainerBuilder,
  TextDisplayBuilder,
  type Client,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { safeGuild, safeUser } from "utils/safeThings";

/**
 * Sends a container containing an log/info message.
 * @param client The client, use when interaction is unavailable.
 * @param guildID The guild ID to log the message in (will take the log channel)
 * @param title Short description of the error.
 * @param description The log description.
 * @param dmOwner DMs the owner with this error.
 * @returns Container with the error description.
 */
export async function logEmbed(options: {
  client: Client;
  guildID: string | null;
  title: string;
  description: string;
  dmOwner?: boolean;
}): Promise<Message | InteractionResponse | undefined> {
  const { client, guildID, title, description, dmOwner } = options;

  if (!client) {
    console.error("You need to provide either a client or an interaction for errorEmbed to work.");
    return;
  }
  if (!guildID) return;

  function addContent(): string {
    const content = [];
    if (title) content.push(`**${title}**`);
    if (description) content.push(description);
    return content.join("\n");
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Heads up!"),
      new TextDisplayBuilder().setContent(addContent()),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

  const guild = await safeGuild(client, guildID);
  const message = await logChannel(
    guild,
    { components: [container], flags: ["IsComponentsV2"] },
    dmOwner,
    {
      isSilent: false,
      user: await safeUser(client, guild.ownerId),
      options: { components: [container], flags: ["IsComponentsV2"] },
    },
  );

  return message;
}
