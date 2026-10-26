import { getNews, updateNews } from "database/news";
import { getSetting } from "database/settings";
import type { Guild, GuildMember, TextChannel } from "discord.js";
import { newsEmbed } from "embeds/newsEmbed";
import { replaceVariables } from "utils/replace";
import { safeChannel } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";
import type { FeatureOutput } from "types";
import { feature, type MethodParameters } from "utils/feature";

interface P {
  id: number;
  guild: Guild;
  userMember: GuildMember;
  /** Use interaction.channel on Discord, and a required channel thru the API. */
  fallbackChannel: TextChannel;
  rawTitle: string;
  rawBody: string;
}

async function method(
  ...parameters: MethodParameters<P, { ok: true }>
): Promise<FeatureOutput<{ ok: true }>> {
  const [ok, fail, options] = parameters;
  const { id, guild, userMember, fallbackChannel, rawTitle, rawBody } = options;
  if (!userMember.permissions.has("ManageGuild"))
    return fail({
      title: "You can’t execute this command.",
      reason: "You need the **Manage Server** permission.",
    });

  const news = await getNews(guild.id, id);
  if (!news)
    return fail({
      title: "The specified news post doesn’t exist.",
    });

  const title = await replaceVariables(rawTitle, guild, userMember.user);

  const body = await replaceVariables(rawBody, guild, userMember.user);

  if (!(await getSetting(guild.id, "news", "edit_original_message"))) {
    await sendChannelNews(
      guild,
      fallbackChannel,
      { title, body, author_id: news.author_id, id },
      true,
    );
    return ok({ ok: true });
  }

  const channel = (await safeChannel(
    guild,
    (await getSetting(guild.id, "news", "channel")) ?? fallbackChannel.id,
  )) as TextChannel; // TODO: change this assertion

  const embed = await newsEmbed(guild, { title, body, author_id: news.author_id, id }, true);

  await Promise.all([
    channel.messages.edit(news.message_id, {
      components: [embed],
      flags: "IsComponentsV2",
    }),
    updateNews(guild.id, id, title, body),
  ]);

  // TODO
  return ok({ ok: true });
}

export const edit = feature("news/edit", method);
