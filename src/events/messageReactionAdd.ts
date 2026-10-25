import { getSetting } from "database/settings";
import { getStarred, setStarred } from "database/starboard";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  type Message,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { useLogEmbed } from "embeds/logEmbed";
import { channelCheck, hasChannelPerms } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeChannel, safeUser } from "utils/safeThings";
import type { Event } from "types";
import { PotatoState } from "states";
import ms from "enhanced-ms";

export default (async function run(reaction, user) {
  const client = user.client;
  const guildID = reaction.message.guildId;
  const channelID = reaction.message.channelId;
  const errorExtras = {
    guildId: guildID,
    channelId: channelID,
    messageId: reaction.message.id,
    userId: user.id,
  };

  if (!guildID || !reaction.message.guild || !(await getSetting(guildID, "starboard", "enabled")))
    return;

  if (!hasChannelPerms(reaction.message.channel, "ReadMessageHistory"))
    return useLogEmbed(
      reaction.message.guild,
      "Sokora is missing permissions",
      `The channel <#${channelID}> does not allow Sokora to \`Read message history\`, starboard will not work in this channel until fixed`,
    );

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
  const { guild, author, content, createdAt, url, id, attachments } = message;
  if (!guild) return;

  if (reaction.emoji.name == "🥔") {
    const state = PotatoState.get(guild.id);
    if (!state || author.id === state.heldBy || author.bot || message.webhookId) return;
    const passTimeout = (Date.now() - state.lastPass) * 1000;
    const setting = await getSetting(guild.id, "games", "hot_potato");
    if (!setting || passTimeout < setting.pass_timeout) return;

    const newState = PotatoState.update(guild.id, previous => {
      return previous
        ? {
            ...previous,
            passes: previous.passes + 1,
            heldBy: author.id,
            lastPass: Date.now(),
          }
        : previous;
    });
    if (!newState) return;
    const remainingTime = ms(setting.burn_timeout * 1000 - (Date.now() - newState.started));
    await message.reply(
      `The hot potato **${newState.heldBy === state.startedBy ? "returns" : "now goes"} to ${mention(author.id, "USER")}**! **You have ${remainingTime} left to pass it to someone else** by reacting them with a 🥔!`,
    );
    return;
  }

  if (!(await getSetting(guild.id, "starboard", "enabled"))) return;
  const starEmoji = await getSetting(guild.id, "starboard", "emoji");
  if (reaction.emoji.name != starEmoji) return;
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
      await setStarred(
        guild.id,
        id,
        message.channel.id,
        author.id,
        (await starboardChannel.send({ components: containers, flags: "IsComponentsV2" })).id,
        starCount,
        new Date(message.createdTimestamp),
      );
      return;
    }

    const starMessage = await starboardChannel.messages.fetch(existingStarred.star_message_id);
    if (starMessage.partial) await starMessage.fetch();
    await starMessage.edit({ components: containers, flags: "IsComponentsV2" });
    await setStarred(
      guild.id,
      id,
      existingStarred.channel_id,
      author.id,
      existingStarred.message_id,
      starCount,
      new Date(message.createdTimestamp),
    );
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
