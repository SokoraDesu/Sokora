import { getSetting } from "database/settings";
import {
  AttachmentBuilder,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { client } from "botfile";
import { checkForS } from "utils/checkForS";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { fetchMedia } from "utils/media";
import { mention } from "utils/mention";
import type { Event } from "types";

export default (async function run(message) {
  try {
    if (message.partial) return;
    const author = message.author;
    if (!author)
      return await errorEmbed(true, {
        client,
        title: "Cannot log deleted message.",
        reason: `Message ${message} lacks an author.`,
      });

    if (author.bot) return;
    const guild = message.guild;
    if (!guild)
      return await errorEmbed(true, {
        client,
        title: "Cannot log deleted message.",
        reason: `Message ${message} lacks the guild.`,
      });

    if (!(await getSetting(guild.id, "moderation", "events"))?.includes("messageDelete")) return;

    let media: { image: string | null; video: string | null; thumbnail: string | null };
    try {
      media = await fetchMedia(message);
    } catch (error) {
      return await errorEmbed(true, {
        client,
        error,
        title: "Error fetching meta image.",
        fileName: "messageDelete",
      });
    }

    const { image, video, thumbnail } = media;
    const content = message.content;
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${checkForS(author.username)} message got deleted**`,
        ),
        new TextDisplayBuilder().setContent(
          content.length <= 2048
            ? (content && content.length > 0
              ? content
              : "*Empty message*")
            : "*The deleted message is an attachment below due to it being too large.*",
        ),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Red }));

    const files: AttachmentBuilder[] = [];
    if (content.length > 2048) {
      files.push(new AttachmentBuilder(Buffer.from(content, "utf8"), { name: "message.txt" }));
      container.addFileComponents(new FileBuilder().setURL("attachment://message.txt"));
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

    return await logChannel(guild, {
      components: [container],
      files,
      flags: "IsComponentsV2",
    });
  } catch (error) {
    return await errorEmbed(true, { client, error, fileName: "messageDelete" });
  }
} as Event<"messageDelete">);
