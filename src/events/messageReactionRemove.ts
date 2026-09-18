import { getSetting } from "database/settings";
import { deleteStarred, getStarred, setStarred } from "database/starboard";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeChannel, safeUser } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(reaction, user) {
  const client = user.client;
  const errorExtras = {
    guild: reaction.message.guildId,
    channel: reaction.message.channelId,
    message: reaction.message.id
  };
  if (reaction.partial)
    try {
      await reaction.fetch();
    } catch (error) {
      return await errorEmbed({
        client,
        error,
        title: "Error fetching reaction.",
        log: true,
        forward: true,
        fileName: "messageReactionRemove",
        extras: errorExtras,
      });
    }

  if (user.partial)
    try {
      await safeUser(client, user.id);
    } catch (error) {
      await errorEmbed({
        client,
        error,
        title: "Error fetching user.",
        log: true,
        forward: true,
        fileName: "messageReactionRemove",
        extras: errorExtras,
      });
    }

  const message = await reaction.message.fetch();
  const { guild, author, content, createdAt, url, id, attachments } = message;
  if (!guild) return;

  const starEmoji = await getSetting(guild.id, "starboard", "emoji");
  if (reaction.emoji.name != starEmoji) return;
  if (!(await getSetting(guild.id, "starboard", "enabled"))) return;
  if (!content && attachments.size === 0) return;

  const starboardChannelId = await getSetting(guild.id, "starboard", "channel");
  if (!starboardChannelId) return;

  const starboardChannel = await safeChannel(guild, starboardChannelId);
  if (
    !starboardChannel?.isTextBased() ||
    !(await channelCheck({
      channel: starboardChannel,
      guild,
      permType: "Send",
      setting: { category: "starboard", setting: "channel" },
    })) ||
    starboardChannel.isDMBased()
  )
    return;

  let starCount = reaction.count ?? 0;
  if (reaction.users.valueOf().has(user.id)) starCount--;

  const existingStarred = await getStarred(guild.id, message.id);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${author.displayName}  •  [${starCount}](${url}) ${starEmoji}`,
      ),
      new TextDisplayBuilder().setContent(content),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Yellow }));

  const reference = message.reference ? await message.fetchReference() : null;
  const containers = [];
  const attachment = attachments.first();
  if (attachment?.contentType?.startsWith("image/"))
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(attachment.url)),
    );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${mention(createdAt.valueOf(), "DEFAULT_TIMESTAMP")}`),
  );

  containers.push(container);
  if (reference && !reference.author.bot && reference.content.length > 0)
    containers.push(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${reference.author.displayName}  •  [Replied by starred message](${reference.url})**`,
          ),
          new TextDisplayBuilder().setContent(reference.content),
          new TextDisplayBuilder().setContent(
            `-# ${mention(reference.createdAt.valueOf(), "DEFAULT_TIMESTAMP")}`,
          ),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Blue })),
    );

  try {
    if (!existingStarred) return;

    const starMessage = await starboardChannel.messages.fetch(existingStarred.star_message);
    if (starMessage.partial) await starMessage.fetch();
    if (starCount == 0) {
      await starMessage.delete();
      await deleteStarred(guild.id, id);
      return;
    }

    await starMessage.edit({ components: containers, flags: "IsComponentsV2" });
    await setStarred(
      guild.id,
      id,
      existingStarred.channel,
      author.id,
      existingStarred.message,
      starCount,
      new Date(message.createdTimestamp),
    );
  } catch (error) {
    await errorEmbed({
      client,
      error,
      title: "Error handling starboard message.",
      log: true,
      forward: true,
      fileName: "messageReactionRemove",
      extras: errorExtras,
    });
  }
} as Event<"messageReactionRemove">);
