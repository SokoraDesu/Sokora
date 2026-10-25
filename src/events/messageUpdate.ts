import { getSetting } from "database/settings";
import {
  AttachmentBuilder,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { fetchMedia } from "utils/media";
import { mention } from "utils/mention";
import type { Event } from "types";
import { errorEmbed } from "embeds/errorEmbed";

export default (async function run(oldMessage, newMessage) {
  try {
    if (oldMessage.partial) return;
    const author = oldMessage.author;
    if (author.bot) return;

    const guild = oldMessage.guild;
    if (
      !guild ||
      !(await getSetting(guild.id, "moderation", "events"))?.toString().includes("messageUpdate")
    )
      return;

    const client = oldMessage.client;
    const oldContent = oldMessage.content;
    const newContent = newMessage.content;
    if (oldContent == newContent) return;
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    let media;

    try {
      media = await fetchMedia(newMessage);
    } catch (error) {
      return await errorEmbed(true, {
        client,
        error,
        title: "Error fetching meta image.",
        fileName: "messageUpdate",
      });
    }

    const { image, video, thumbnail } = media;
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `[**${author.username} edited a message**](${oldMessage.url})`,
        ),
        new TextDisplayBuilder().setContent(
          [
            `**🖋️ • Old**: ${
              oldLength <= 2048
                ? oldContent
                : "*The old content of the message is an attachment below due to it being too large.*"
            }`,
            `**🖊️ • New**: ${
              newLength <= 2048
                ? newContent
                : `*The new content of the message is${oldContent.length > 2048 ? " also" : ""} an attachment below this embed due to it being too large.*`
            }`,
          ].join("\n"),
        ),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Yellow }));

    const files: AttachmentBuilder[] = [];
    if (oldLength > 2048) {
      files.push(
        new AttachmentBuilder(Buffer.from(oldContent, "utf8"), { name: "oldContent.txt" }),
      );
      container.addFileComponents(new FileBuilder().setURL("attachment://oldContent.txt"));
    }

    if (newLength > 2048) {
      files.push(
        new AttachmentBuilder(Buffer.from(oldContent, "utf8"), { name: "newContent.txt" }),
      );
      container.addFileComponents(new FileBuilder().setURL("attachment://newContent.txt"));
    }

    const mediaFiles = [];
    if (thumbnail != null) mediaFiles.push(thumbnail);
    if (image != null) mediaFiles.push(image);
    if (video != null) mediaFiles.push(video);
    if (mediaFiles.length > 0)
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          mediaFiles.map(url => new MediaGalleryItemBuilder().setURL(url)),
        ),
      );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# User ID: ${author.id} • ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`,
      ),
    );

    return await logChannel(guild, { components: [container], files, flags: "IsComponentsV2" });
  } catch (error) {
    return await errorEmbed(true, {
      client: oldMessage.client,
      error,
      fileName: "messageUpdate",
    });
  }
} as Event<"messageUpdate">);
