import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type TextChannel,
} from "discord.js";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { replaceVariables } from "utils/replace";
import { safeChannel } from "utils/safeThings";
import type { Event } from "types";

export default (async function run(member) {
  const guild = member.guild;
  if (guild.bans.cache.has(member.id)) return;

  const guildID = guild.id;
  const id =
    (await getSetting(guildID, "welcome", "leave_channel")) ??
    (await getSetting(guildID, "welcome", "join_channel"));

  if (!id) return;
  const user = member.user;
  const avatar = user.displayAvatarURL();
  const channel = (await safeChannel(guild, id)) as TextChannel;
  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${user.displayName} left`),
          new TextDisplayBuilder().setContent(
            await replaceVariables(await getSetting(guildID, "welcome", "leave_text"), guild, user),
          ),
          new TextDisplayBuilder().setContent(`-# User ID: ${user.id}`),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    )
    .setAccentColor(await colorize({ user, avatar, hue: Sokolors.Yellow }));

  if (
    await channelCheck({
      guild,
      channel,
      permType: "Send",
      setting: { category: "welcome", setting: "leave_channel" },
    })
  )
    await channel.send({ components: [container], flags: "IsComponentsV2" });
} as Event<"guildMemberRemove">);
