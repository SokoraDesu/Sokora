import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  type MessageCreateOptions,
  TextDisplayBuilder,
  type Guild,
  type User,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { safeUser } from "utils/safeThings";

async function buildLogEmbed(
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
 * Builds and automatically sends a logEmbed, a simple notification embed that can be used for log/info messages, permission errors, and other important stuff. Honors notification settings.
 *
 * @param guild - Guild.
 * @param title - Title of the embed.
 * @param whatHappened - Text below a "what happened?" title.
 */
export async function logEmbed(guild: Guild, title: string, whatHappened: string): Promise<void> {
  const container = await buildLogEmbed(guild, title, whatHappened);
  const shouldDm = await getSetting(guild.id, "notifications", "dm_owner");
  const dmOptions = shouldDm
    ? {
        isSilent: false,
        user: await safeUser(guild.client, guild.ownerId),
        options: { components: [container], flags: ["IsComponentsV2"] } as MessageCreateOptions,
      }
    : undefined;

  await logChannel(
    guild,
    { components: [container], flags: ["IsComponentsV2"] },
    shouldDm,
    dmOptions,
    "notifications",
  );
}

// TODO(v0.4): make this consistent with other embeds + move it to another file
// (will obv require changes to log embed itself)
export async function userLogEmbed(
  user: User,
  guild: Guild,
  title: string,
  whatHappened: string,
): Promise<void> {
  try {
    const dmChannel = await user.createDM();
    await dmChannel.send({
      components: [await buildLogEmbed(guild, title, whatHappened)],
      flags: "IsComponentsV2",
    });
  } catch {
    // ignore
  }
}
