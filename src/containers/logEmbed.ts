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

interface Options {
  guild: Guild;
  title: string;
  text: string;
}

async function buildLogEmbed(options: Options): Promise<ContainerBuilder> {
  const { title, text, guild } = options;
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}`),
      new TextDisplayBuilder().setContent(["### ⁉️ • What happened", text].join("\n")),
      new TextDisplayBuilder().setContent(`-# This is coming from ${guild.name} • ID: ${guild.id}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));
}

/**
 * Builds and automatically sends a logEmbed, a simple notification embed that can be used for log/info messages, permission errors, and other important stuff. Honors notification settings.
 *
 * @param payload - Options for an embed to send to a guild’s log channel. DMs the owner if needed, so no need to use `userPayload` for that.
 * @param userPayload - Options for DMing a user with another log embed (or the same). Fails silently if unable to DM them. Omits guild parameter as its supposed to be the same.
 */
export async function logEmbed(
  payload: Options,
  userPayload?: Omit<Options, "guild"> & { user: User },
): Promise<void> {
  const container = await buildLogEmbed(payload);
  const shouldDm = await getSetting(payload.guild.id, "notifications", "dm_owner");
  const dmOptions = shouldDm
    ? {
        isSilent: false,
        user: await safeUser(payload.guild.client, payload.guild.ownerId),
        options: { components: [container], flags: ["IsComponentsV2"] } as MessageCreateOptions,
      }
    : undefined;

  await logChannel(
    payload.guild,
    { components: [container], flags: ["IsComponentsV2"] },
    shouldDm,
    dmOptions,
    "notifications",
  );

  if (!userPayload) return;

  const newContainer = await buildLogEmbed({ ...userPayload, guild: payload.guild });

  try {
    const dmChannel = await userPayload.user.createDM();
    await dmChannel.send({
      components: [newContainer],
      flags: "IsComponentsV2",
    });
  } catch {
    // ignore
  }
}
