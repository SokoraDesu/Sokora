import { getSetting, setSetting } from "database/settings";
import { getStarred, setStarred } from "database/starboard";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  type Message,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { logEmbed } from "embeds/logEmbed";
import { channelCheck, hasChannelPerms } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeChannel, safeUser } from "utils/safeThings";
import type { Event } from "types";

export default (async function run(reaction, user) {
  const client = user.client;
  const guild = reaction.message.guild;
  if (!guild || !(await getSetting(guild.id, "starboard", "enabled"))) return;
  const channelID = reaction.message.channelId;
  const errorExtras = {
    guild_id: guild.id,
    channel: channelID,
    message: reaction.message.id,
    user: user.id,
  };

  if (!hasChannelPerms(reaction.message.channel, "ReadMessageHistory"))
    return logEmbed({
      guild,
      title: "Sokora is missing permissions",
      text: `The channel <#${channelID}> does not allow Sokora to \`Read message history\`, starboard will not work in this channel until fixed`,
    });

  if (reaction.partial)
    try {
      await reaction.fetch();
    } catch (error) {
      return await errorEmbed(true, {
        client,
        error,
        title: "Error fetching reaction.",
        fileName: "messageReactionAdd",
        extras: errorExtras,
      });
    }

  if (user.partial)
    try {
      await safeUser(client, user.id);
    } catch (error) {
      return await errorEmbed(true, {
        client,
        error,
        title: "Error fetching user.",
        fileName: "messageReactionAdd",
        extras: errorExtras,
      });
    }

  if (reaction.message.partial)
    try {
      await reaction.message.fetch();
    } catch (error) {
      return await errorEmbed(true, {
        client,
        error,
        title: "Error fetching message.",
        fileName: "messageReactionAdd",
        extras: errorExtras,
      });
    }

  const message = reaction.message as Message;
  const { author, content, createdAt, url, id, attachments } = message;

  if (!content && attachments.size === 0) return;

  if (reaction.emoji.name == "🥔") return;

  const starEmoji = await getSetting(guild.id, "starboard", "emoji");
  if (reaction.emoji.name != starEmoji) return;

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
  ) {
    await setSetting(guild.id, "starboard", "channel", undefined);
    await logEmbed({
      guild,
      title: "A channel is misconfigured in your server!",
      text: `Starboard is enabled in this server, however **the starboard channel was somehow set to a channel that is either not text-based, DM-based or that disallows Sokora from sending messages**, which stops the starboard from working. **This setting has been reset to default.**`,
    });
    return;
  }

  let starCount = reaction.count ?? 0;
  const threshold = await getSetting(guild.id, "starboard", "threshold");
  if (reaction.users.valueOf().has(message.author.id)) starCount--;
  if (starCount < threshold) return;

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
    if (!existingStarred) {
      await setStarred({
        guild_id: guild.id,
        star_message_id: id,
        channel_id: message.channel.id,
        author_id: author.id,
        message_id: (
          await starboardChannel.send({ components: containers, flags: "IsComponentsV2" })
        ).id,
        stars: starCount,
        timestamp: Temporal.Instant.fromEpochMilliseconds(message.createdTimestamp),
      });
      return;
    }

    const starMessage = await starboardChannel.messages.fetch(existingStarred.star_message_id);
    if (starMessage.partial) await starMessage.fetch();
    await starMessage.edit({ components: containers, flags: "IsComponentsV2" });
    await setStarred({
      guild_id: guild.id,
      star_message_id: id,
      channel_id: existingStarred.channel_id,
      author_id: author.id,
      message_id: existingStarred.message_id,
      stars: starCount,
      timestamp: Temporal.Instant.fromEpochMilliseconds(message.createdTimestamp),
    });
  } catch (error) {
    return await errorEmbed(true, {
      client,
      error,
      title: "Error handling starboard message.",
      fileName: "messageReactionAdd",
      extras: errorExtras,
    });
  }
} as Event<"messageReactionAdd">);
