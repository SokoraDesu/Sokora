import { getSetting } from "database/settings";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { logChannel } from "utils/logChannel";
import { fetchMedia } from "utils/media";
import type { Event } from "utils/types";

const MESSAGE_LENGTH_CAP = 1024;
export default (async function run(oldMessage, newMessage) {
  if (oldMessage.partial) return;
  const author = oldMessage.author;
  if (author.bot) return;

  const guild = oldMessage.guild;
  if (
    !guild ||
    !(await getSetting(guild.id, "moderation", "events"))?.toString().includes("messageUpdate")
  )
    return;

  const oldContent = oldMessage.content;
  const newContent = newMessage.content;
  if (oldContent == newContent) return;
  const oldLength = oldContent.length;
  const newLength = newContent.length;
  const avatar = author.displayAvatarURL();

  let media;

  try {
    media = await fetchMedia(newMessage);
  } catch (error) {
    return await errorEmbed({
      client: newMessage.client,
      error,
      title: "Error fetching meta image.",
      forward: true,
      fileName: "messageUpdate.ts",
    });
  }

  const { image, video, thumbnail } = media;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${author.username} edited a message`,
      iconURL: avatar,
    })
    .setTimestamp(new Date())
    .addFields(
      {
        name: "🖋️ • Old message",
        value:
          oldLength <= MESSAGE_LENGTH_CAP
            ? oldContent
            : "*The old content of the message is an attachment below this embed due to it being too large.*",
      },
      {
        name: "🖊️ • New message",
        value:
          newLength <= MESSAGE_LENGTH_CAP
            ? newContent
            : `*The old content of the message is${oldContent.length > 4096 ? " also" : ""} an attachment below this embed due to it being too large.*`,
      },
    )
    .setThumbnail(thumbnail)
    .setImage(image)
    .setFooter({ text: `User ID: ${author.id}` })
    .setColor(await colorize({ hue: Sokolors.Yellow }));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("• Jump to message")
      .setURL(oldMessage.url)
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Link),
  );

  const files: AttachmentBuilder[] = [];
  if (oldLength >= MESSAGE_LENGTH_CAP)
    files.push(new AttachmentBuilder(Buffer.from(oldContent, "utf8"), { name: "oldContent.txt" }));

  if (newLength >= MESSAGE_LENGTH_CAP)
    files.push(new AttachmentBuilder(Buffer.from(newContent, "utf8"), { name: "newContent.txt" }));

  if (video) files.push(new AttachmentBuilder(video, { name: "tenor.mp4" }));
  await logChannel(guild, { embeds: [embed], files: files, components: [row] });
} as Event<"messageUpdate">);
