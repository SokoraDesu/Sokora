import type { Message } from "discord.js";
import { ENABLE_MEDIA_FETCHING } from "const";

/**
 * BEWARE.
 *
 * Fetches media from a message.
 *
 * Requires the ENABLE_MEDIA_FETCHING environment variable to be on.
 *
 * @remarks
 * This code fetches certain meta tags, as well as other content (e.g, images, videos), from external URLs sent by users.
 * This is a MAJOR security risk, as it can lead to skids being able to retrieve the bot's IP address by sending a link to a webserver that they control, possibly leading to DDoS attacks.
 * If you are self hosting this, it's highly recommended to disable this feature within your .env configuration to prevent this from happening.
 * Otherwise, if you have the appropriate security measures in place, you can leave it enabled.
 *
 * WITH GREAT POWER COMES GREAT RESPONSIBILITY (or smth).
 *
 * @param message - Message to fetch media from.
 * @returns Message's media: an image, video (or a GIF) or a thumbnail
 */
export async function fetchMedia(
  message: Message,
): Promise<{ image: string | null; video: string | null; thumbnail: string | null }> {
  const regex = /(http|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])/;
  const match = message.content ? regex.exec(message.content) : null;
  const url = match ? match[0] : null;
  let thumbnail = null;
  let image = null;
  let video = null;

  if (!url || !message.content || ENABLE_MEDIA_FETCHING != "true")
    return { image, video, thumbnail };

  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  const isGif = /(tenor|klipy)\.com\/view\//i.test(url);
  const isWebsite = !isImage && !isGif && !isVideo;

  if (isImage) image = url;
  else if (isVideo) video = url;
  else if (isGif || isWebsite) {
    const content = await (await fetch(url)).text();
    const metaContentMatch =
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i.exec(content) ??
      /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(
        content,
      ) ??
      /<meta\s+property=["']twitter:image["']\s+content=["']([^"']+)["']/i.exec(content);

    const metaContent = metaContentMatch ? metaContentMatch[1] : undefined;
    if (metaContent)
      if (isGif) video = metaContent;
      else if (isWebsite) thumbnail = metaContent;
  }

  return { image, video, thumbnail };
}
