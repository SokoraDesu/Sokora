import { getLatestNews } from "database/news";
import { getSetting } from "database/settings";
import type {
  Attachment,
  Guild,
  GuildMember,
  NewsChannel,
  ReadonlyCollection,
  TextChannel,
} from "discord.js";
import type { FeatureOutput } from "types";
import { feature, type MethodParameters } from "utils/feature";
import { dekominator } from "utils/kominator";
import { replaceVariables } from "utils/replace";
import { sendChannelNews } from "utils/sendChannelNews";

interface P {
  userMember: GuildMember;
  guild: Guild;
  rawTitle: string;
  rawBody: string;
  media: ReadonlyCollection<string, Attachment> | null;
  category: string;
  fallbackChannel: TextChannel | NewsChannel;
}

async function method(
  ...parameters: MethodParameters<P, { ok: true }>
): Promise<FeatureOutput<{ ok: true }>> {
  const [ok, fail, options] = parameters;
  const { userMember, guild, rawTitle, rawBody, media, category, fallbackChannel } = options;

  if (!userMember.permissions.has("ManageGuild"))
    return fail({
      title: "You can’t execute this command.",
      reason: "You need the **Manage Server** permission.",
    });

  const title = await replaceVariables(rawTitle, guild, userMember.user);

  const body = await replaceVariables(rawBody, guild, userMember.user);

  await sendChannelNews(guild, fallbackChannel, {
    title,
    body,
    author_id: userMember.id,
    image_url: media
      ? dekominator(
          media
            .filter(item => {
              return (
                item.contentType &&
                (item.contentType.startsWith("image/") || item.contentType.startsWith("video/"))
              );
            })
            .map(image => image.url)
            .toReversed(),
        )
      : undefined,
    id: ((await getLatestNews(guild.id))[0]?.id ?? 0) + 1,
    category_id:
      (await getSetting(guild.id, "news", "categories")).length > 0 ? category : undefined,
  });

  return ok({ ok: true });
}

export const post = feature("news/post", method);
