import { getSetting } from "database/settings";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { client } from "src/bot";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { logChannel } from "utils/logChannel";
import { fetchMedia } from "utils/media";
import type { Event } from "utils/types";

export default (async function run(message) {
  try {
    if (message.partial) return;
    const author = message.author;
    if (!author)
      return await errorEmbed({
        client,
        title: "Cannot log deleted message.",
        reason: `Message ${message} lacks an author.`,
      });

    if (author.bot) return;
    const guild = message.guild;
    if (!guild)
      return await errorEmbed({
        client,
        title: "Cannot log deleted message.",
        reason: `Message ${message} lacks the guild.`,
      });

    if (!(await getSetting(guild.id, "moderation", "events"))?.toString().includes("messageDelete"))
      return;

    let media;
    try {
      media = await fetchMedia(message);
    } catch (error) {
      return await errorEmbed({
        client,
        error,
        title: "Error fetching meta image.",
        forward: true,
        fileName: "messageDelete.ts",
      });
    }

    const { image, video, thumbnail } = media;
    const avatar = author.displayAvatarURL();
    const content = message.content;
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${dotCheck({ string: avatar, doubleSpace: true })}${author.username} deleted a message`,
        iconURL: avatar,
      })
      .setDescription(
        content.length <= 1024
          ? (content && content.length > 0
            ? content
            : "*Empty message*")
          : "*The deleted message is an attachment below this embed due to it being too large.*",
      )
      .setThumbnail(thumbnail)
      .setImage(image)
      .setTimestamp(new Date())
      .setFooter({ text: `Author ID: ${author.id}` })
      .setColor(await colorize({ hue: Sokolors.Red }));

    const files: AttachmentBuilder[] = [];
    if (content.length >= 1024)
      files.push(new AttachmentBuilder(Buffer.from(content, "utf8"), { name: "message.txt" }));

    if (video) files.push(new AttachmentBuilder(video, { name: "tenor.mp4" }));
    return await logChannel(guild, { embeds: [embed], files });
  } catch (error) {
    return await errorEmbed({
      client,
      error,
      log: true,
      forward: true,
      fileName: "messageDelete.ts",
    });
  }
} as Event<"messageDelete">);
