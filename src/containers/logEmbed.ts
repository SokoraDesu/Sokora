import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  type MessageCreateOptions,
  TextDisplayBuilder,
  type InteractionResponse,
  type Message,
  type Guild,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { safeUser } from "utils/safeThings";

// TODO(v0.4)(@ZakaHaceCosas):
// - check if i can MVC / improve / refactor this or not
// - drop build/use division here
// - ehhhh review usage of this together with usage of logEmbed

/**
 * A tinier and simpler than `errorEmbed` container that also conveys an error.
 *
 * Can be used for permission errors, other fixable errors, or even non-error important notifications.
 *
 * @param guild - Guild.
 * @param title - Title of the embed.
 * @param whatHappened - Text below a "what happened?" title.
 * @returns
 */
export async function buildLogEmbed(
  guild: Guild,
  title: string,
  whatHappened: string,
): Promise<ContainerBuilder> {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}`),
      new TextDisplayBuilder().setContent(["### ⁉️ • What happened", whatHappened].join("\n")),
      new TextDisplayBuilder().setContent(`-# This is coming from ${guild.name} • ID: ${guild.id}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));
}

/**
 * Builds and automatically sends a logEmbed ({@link buildLogEmbed}), containing a log/info message. Respects notification settings.
 *
 * @param guild - Guild.
 * @param title - Title of the embed.
 * @param whatHappened - Text below a "what happened?" title.
 * @returns Container with the log description.
 */
export async function useLogEmbed(
  guild: Guild,
  title: string,
  whatHappened: string,
): Promise<Message | InteractionResponse | undefined> {
  const container = await buildLogEmbed(guild, title, whatHappened);
  const shouldDm = await getSetting(guild.id, "notifications", "dm_owner");
  const dmOptions = shouldDm
    ? {
        isSilent: false,
        user: await safeUser(guild.client, guild.ownerId),
        options: { components: [container], flags: ["IsComponentsV2"] } as MessageCreateOptions,
      }
    : undefined;
  const message = await logChannel(
    guild,
    { components: [container], flags: ["IsComponentsV2"] },
    shouldDm,
    dmOptions,
    "notifications",
  );

  return message;
}
