import { type NewsPost, postNews, updateNews } from "database/news";
import { getSetting } from "database/settings";
import type { Guild, NewsChannel, TextChannel } from "discord.js";
import { newsEmbed } from "embeds/newsEmbed";
import { channelCheck } from "./channelCheck";
import { safeChannel } from "./safeThings";

/**
 * Sends news to a channel.
 * @param guild - Guild where the channel is in.
 * @param fallbackChannel - Where to send to if a news channel isn’t set.
 * (TODO(v0.4): i think we’re duplicating calls to get the news channel? review pls, as that’s bad)
 * @param newsOptions - Options to send the news post.
 * @param willEdit - Whether or not should the function make a new message with some reused elements.
 * @returns News message in a channel.
 */
export async function sendChannelNews(
  guild: Guild,
  fallbackChannel: TextChannel | NewsChannel,
  newsOptions: {
    title: string;
    body: string;
    author_id: string;
    id: number;
    image_url?: string;
    category_id?: string;
  },
  willEdit?: boolean,
): Promise<NewsPost | undefined> {
  const { title, body, author_id, id, image_url, category_id } = newsOptions;

  const category = await getSetting(guild.id, "news", "categories", category_id);
  const channel = (await safeChannel(
    guild,
    category.channel ?? (await getSetting(guild.id, "news", "channel")) ?? fallbackChannel.id,
  )) as TextChannel;

  if (
    !(await channelCheck({
      channel,
      guild,
      permType: "Send",
      setting: { category: "news", setting: "channel" },
    }))
  )
    return;

  const message = await channel.send({
    components: [
      await newsEmbed(guild, {
        title,
        body,
        author_id,
        id,
        image_url,
        categoryRoles: category.roles,
      }),
    ],
    flags: "IsComponentsV2",
  });
  if (willEdit) {
    await updateNews(guild.id, id, title, body, message.id);
    return;
  }

  return await postNews({
    guild_id: guild.id,
    title,
    body,
    author_id,
    message_id: message.id,
    image_url,
    id,
    category_id,
  });
}
