import { getSetting } from "database/settings";
import { EmbedBuilder, type TextChannel } from "discord.js";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { replaceVariables } from "utils/replace";
import { safeChannel } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(member) {
  const guild = member.guild;
  if (guild.bans.cache.has(member.id)) return;

  const guildID = guild.id;
  const id =
    ((await getSetting(guildID, "welcome", "leave_channel")) as string) ??
    ((await getSetting(guildID, "welcome", "join_channel")) as string);

  if (!id) return;
  const user = member.user;
  const avatar = user.displayAvatarURL();
  const channel = (await safeChannel(guild, id)) as TextChannel;
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${user.displayName} left`,
      iconURL: avatar,
    })
    .setDescription(
      await replaceVariables(
        (await getSetting(guildID, "welcome", "leave_text")) as string,
        guild,
        user,
      ),
    )
    .setFooter({ text: `User ID: ${user.id}` })
    .setColor(await colorize({ user, avatar, hue: Sokolors.Blue }));

  if (
    await channelCheck({
      guild,
      channel,
      permType: "Send",
      setting: { category: "welcome", setting: "leave_channel" },
    })
  )
    await channel.send({ embeds: [embed] });
} as Event<"guildMemberRemove">);
