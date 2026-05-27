import { getSetting } from "database/settings";
import { EmbedBuilder, type TextChannel } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { kominator } from "utils/kominator";
import { replaceVariables } from "utils/replace";
import { safeChannel } from "utils/safeThings";
import type { Event } from "utils/types";

export default (async function run(member) {
  const guild = member.guild;
  const guildID = guild.id;
  const id =
    ((await getSetting(guildID, "welcome", "join_channel")) as string) ??
    ((await getSetting(guildID, "welcome", "leave_channel")) as string);

  if (!id) return;
  const roles = await getSetting(guildID, "welcome", "roles");
  const user = member.user;
  const avatar = user.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${user.displayName} joined`,
      iconURL: avatar,
    })
    .setDescription(
      await replaceVariables(
        (await getSetting(guildID, "welcome", "join_text")) as string,
        guild,
        user,
      ),
    )
    .setFooter({ text: `User ID: ${user.id}` })
    .setColor(await colorize({ user, avatar, hue: Sokolors.Blue }));

  const channel = (await safeChannel(guild, id)) as TextChannel;
  if (
    await channelCheck({
      guild,
      channel,
      permType: "Send",
      setting: { category: "welcome", setting: "join_channel" },
    })
  ) {
    if (roles && !user.bot) await member.roles.add([...kominator(roles as string)]);
    await channel.send({ embeds: [embed] });
  }

  if (!(await getSetting(guildID, "welcome", "join_dm"))) return;
  const dmChannel = await user.createDM().catch(() => null);
  if (!dmChannel || user.bot) return;

  embed.setDescription(
    await replaceVariables(
      (await getSetting(guildID, "welcome", "dm_text")) as string,
      guild,
      user,
    ),
  );

  try {
    await dmChannel.send({ embeds: [embed] });
  } catch (error) {
    return await errorEmbed({
      client: member.client,
      error,
      log: true,
      forward: true,
      fileName: "guildMemberAdd.ts",
    });
  }
} as Event<"guildMemberAdd">);
