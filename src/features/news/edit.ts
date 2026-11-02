import { type NewsPost, updateNews } from "database/news";
import { getSetting } from "database/settings";
import type { Guild, GuildMember, NewsChannel, TextChannel } from "discord.js";
import { newsEmbed } from "embeds/newsEmbed";
import { replaceVariables } from "utils/replace";
import { safeTypedChannel } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";
import type { FeatureOutput } from "types";
import { feature, type MethodParameters } from "utils/feature";

interface P {
  previousPost: NewsPost;
  id: number;
  guild: Guild;
  userMember: GuildMember;
  /** Use interaction.channel on Discord, and a required channel thru the API. */
  fallbackChannel: TextChannel | NewsChannel;
  rawTitle: string;
  rawBody: string;
}

interface O {
  old: NewsPost;
  updated: NewsPost;
}

async function method(...parameters: MethodParameters<P, O>): Promise<FeatureOutput<O>> {
  const [ok, fail, options] = parameters;
  const { id, guild, userMember, fallbackChannel, rawTitle, rawBody, previousPost } = options;
  if (!userMember.permissions.has("ManageGuild"))
    return fail({
      title: "You can’t execute this command.",
      reason: "You need the **Manage Server** permission.",
    });

  const channelId = (await getSetting(guild.id, "news", "channel")) ?? fallbackChannel.id;
  const channel = await safeTypedChannel(guild, channelId, "NewsOrText");

  if (!channel)
    return fail({
      title: "Failed to update news.",
      reason: `Somehow, channel ${channelId} doesn’t exist.`,
    });

  const title = await replaceVariables(rawTitle, guild, userMember.user);
  const body = await replaceVariables(rawBody, guild, userMember.user);

  if (!(await getSetting(guild.id, "news", "edit_original_message"))) {
    const updated = await sendChannelNews(
      guild,
      channel,
      { title, body, author_id: previousPost.author_id, id },
      true,
    );
    if (!updated) throw new Error("An unknown error caused the post to fail. Please report this.");
    return ok({ old: previousPost, updated });
  }

  const embed = await newsEmbed(
    guild,
    { title, body, author_id: previousPost.author_id, id },
    true,
  );

  const [updated] = await Promise.all([
    updateNews(guild.id, id, title, body),
    channel.messages.edit(previousPost.message_id, {
      components: [embed],
      flags: "IsComponentsV2",
    }),
  ]);

  return ok({ old: previousPost, updated });
}

export const edit = feature("news/edit", method);
