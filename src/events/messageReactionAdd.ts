import { getSetting } from "database/settings";
import { getStarred, setStarred } from "database/starboard";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { safeChannel } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(reaction, user) {
  const client = user.client;
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
        fileName: "messageReactionAdd.ts",
      });
    }

  if (user.partial)
    try {
      await user.fetch();
    } catch (error) {
      await errorEmbed({
        client,
        error,
        title: "Error fetching user.",
        log: true,
        forward: true,
        fileName: "messageReactionAdd.ts",
      });
    }

  const message = await reaction.message.fetch();
  const guild = message.guild;
  if (!guild) return;

  const starEmoji = ((await getSetting(guild.id, "starboard", "emoji")) as string) || "⭐";
  if (reaction.emoji.name != starEmoji) return;
  if (!(await getSetting(guild.id, "starboard", "enabled"))) return;
  if (!message.content && message.attachments.size === 0) return;

  const starboardChannelId = (await getSetting(guild.id, "starboard", "channel")) as string;
  if (!starboardChannelId) return;

  const starboardChannel = await safeChannel(guild, starboardChannelId);
  if (
    !starboardChannel ||
    !starboardChannel.isTextBased() ||
    !(await channelCheck({
      channel: starboardChannel,
      guild,
      permType: "Send",
      setting: { category: "starboard", setting: "channel" },
    })) ||
    starboardChannel.isDMBased()
  )
    return;

  const starCount = reaction.count ?? 0;
  const threshold =
    Number.parseInt((await getSetting(guild.id, "starboard", "threshold")) as string) || 3;
  if (starCount < threshold) return;

  const existingStarred = await getStarred(guild.id, message.id);
  const author = message.author;
  const avatar = author.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${author.displayName}  •  ${starCount} ${starEmoji}`,
      iconURL: avatar,
    })
    .setDescription(message.content)
    .setTimestamp(message.createdAt)
    .setFooter({ text: `Message ID: ${message.id}` })
    .setColor(await colorize({ hue: Sokolors.Yellow }));

  const reference = message.reference ? await message.fetchReference() : null;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(`•  Jump to ${reference ? "starred " : ""}`)
      .setURL(message.url)
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Link),
  );

  const embeds = [];
  if (reference) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("•  Jump to replied")
        .setURL(reference.url)
        .setEmoji("🔗")
        .setStyle(ButtonStyle.Link),
    );
    const avatar = reference.author.displayAvatarURL();
    embeds.push(
      new EmbedBuilder()
        .setAuthor({
          name: `${dotCheck({ string: avatar, doubleSpace: true })}${reference.author.displayName}  •  Replied by starred message`,
          iconURL: avatar,
        })
        .setDescription(reference.content)
        .setTimestamp(reference.createdAt)
        .setFooter({ text: `Message ID: ${reference.id}` })
        .setColor(await colorize({ hue: Sokolors.Blue })),
    );
  }

  embeds.push(embed);
  const attachment = message.attachments.first();
  if (attachment?.contentType?.startsWith("image/")) embed.setImage(attachment.url);
  try {
    if (!existingStarred) {
      await setStarred(
        guild.id,
        message.id,
        message.channel.id,
        author.id,
        (await starboardChannel.send({ embeds, components: [row] })).id,
        starCount,
        message.content || "",
        new Date(message.createdTimestamp),
      );
      return;
    }

    await (
      await starboardChannel.messages.fetch(existingStarred.message)
    ).edit({ embeds, components: [row] });
    await setStarred(
      guild.id,
      message.id,
      existingStarred.channel,
      author.id,
      existingStarred.message,
      starCount,
      message.content || "",
      new Date(message.createdTimestamp),
    );
  } catch (error) {
    await errorEmbed({
      client,
      error,
      title: "Error handling starboard message.",
      log: true,
      forward: true,
      fileName: "messageReactionAdd.ts",
    });
  }
} as Event<"messageReactionAdd">);
