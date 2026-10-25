import { deleteNews, getNews } from "database/news";
import { getSetting } from "database/settings";
import type { Guild, GuildMember, NewsChannel, TextChannel } from "discord.js";
import type { FeatureOutput } from "types";
import { feature, type MethodParameters } from "utils/feature";
import { safeChannel } from "utils/safeThings";

interface P {
  id: number;
  guild: Guild;
  userMember: GuildMember;
  fallbackChannel: TextChannel | NewsChannel;
}

async function method(
  ...parameters: MethodParameters<P, { ok: true }>
): Promise<FeatureOutput<{ ok: true }>> {
  const [ok, fail, options] = parameters;
  const { id, userMember, guild, fallbackChannel } = options;

  if (!userMember.permissions.has("ManageGuild")) {
    return fail({
      title: "You can’t execute this command.",
      reason: "You need the **Manage Server** permission.",
    });
  }

  const news = await getNews(guild.id, id);
  if (!news) {
    return fail({ title: "The specified news post doesn’t exist." });
  }

  const newsChannel = (await safeChannel(
    guild,
    (await getSetting(guild.id, "news", "channel")) ?? fallbackChannel.id,
  )) as TextChannel;

  if (newsChannel && news.message_id) await newsChannel.messages.delete(news.message_id);
  await deleteNews(guild.id, id);
  return ok({ ok: true });
}

export const remove = feature("news/remove", method);
