import {
  calculateLevel,
  getLevelRewards,
  getUserXp,
  getXpForNextLevel,
  removeLevelRewards,
  setUserXp,
} from "database/leveling";
import { getSetting } from "database/settings";
import type { SettingReturnType } from "types";
import {
  ContainerBuilder,
  type Guild,
  type GuildMember,
  PermissionsBitField,
  SectionBuilder,
  type TextChannel,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type User,
} from "discord.js";
import { easterEggs } from "handlers/events";
import { channelCheck, hasChannelPerms } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { safeChannel, safeMember, safeMessage, safeRole } from "utils/safeThings";
import { interkora } from "api/v1";
import { assertMessage, type Event } from "types";
import {
  buildMessageFromPayload,
  buildMessageFromPayloadIssue,
  buildPayloadFromMessage,
} from "api/v1/message";
import { errorEmbed } from "embeds/errorEmbed";
import { useLogEmbed } from "embeds/logEmbed";

const cooldowns = new Map<string, number>();

async function grantRewards(
  reward: NonNullable<SettingReturnType<"leveling", "rewards">>[number],
  member: GuildMember,
  push: (s: string) => void,
  guild: Guild,
  author: User,
): Promise<void> {
  if (reward.roles && reward.roles.length > 0)
    for (const _role of reward.roles) {
      if (!_role) continue;
      const role = await safeRole(guild, _role);
      if (!member.roles.cache.has(role.id))
        push(`**You’ve been rewarded the ${mention(role.id, "ROLE")} role!** Congrats.`);

      await member.roles.add(role);
    }

  if (reward.channels && reward.channels.length > 0)
    for (const _channel of reward.channels) {
      if (!_channel) continue;
      const channel = await safeChannel(guild, _channel);
      if (
        !channel.isTextBased() ||
        channel.isDMBased() ||
        channel.isVoiceBased() ||
        channel.isThread()
      )
        continue;

      if (!channel.permissionsFor(member).has("ViewChannel"))
        push(
          `**You’ve been rewarded access to the ${mention(channel.id, "CHANNEL")}> channel!** Congrats.`,
        );

      await channel.permissionOverwrites.set([
        { id: author.id, allow: [PermissionsBitField.Flags.ViewChannel] },
      ]);
    }
}

export default (async function run(_message) {
  const message = await safeMessage(_message, false);
  const author = message.author;
  const content = message.content;

  if (content.startsWith("soko$")) {
    assertMessage(message);
    const payload = await buildPayloadFromMessage(message);
    if (payload.error) await message.reply(buildMessageFromPayloadIssue(payload));
    else {
      const response = await interkora(payload, message.client);
      await message.reply(buildMessageFromPayload(response));
    }
    return;
  }

  if (author.bot) return;
  const guild = message.guild;
  if (!guild) return;

  const client = message.client;
  const clientMember = await safeMember(guild, client.user.id);
  if (await getSetting(guild.id, "easter", "enabled")) {
    const enabledEggs = await getSetting(guild.id, "easter", "enabled_eggs");
    const allowedChannels = await getSetting(guild.id, "easter", "allowed_channels");
    const chances = (await getSetting(guild.id, "easter", "chances")) / 100;

    if (!allowedChannels || allowedChannels.includes(message.channel.id))
      if (hasChannelPerms(message.channel, ["SendMessages", "ReadMessageHistory"]))
        for (const easterEgg of easterEggs) {
          if (enabledEggs && !enabledEggs.includes(easterEgg.name)) continue;
          try {
            if (typeof easterEgg.run == "function" && Math.random() <= chances)
              await easterEgg.run(message);
          } catch (error) {
            return await errorEmbed(true, {
              client,
              error,
              title: `Error running easter egg ${easterEgg.name}.`,
              fileName: "messageCreate",
            });
          }
        }
      else
        await useLogEmbed(
          guild,
          "Sokora is missing permissions",
          `Easter eggs are enabled in <#${message.channel.id}> but Sokora is missing the \`Send messages\` or \`Read message history\` permissions.\nPlease fix it or remove this channel from the easter egg’s allowed channels`,
        );
  }

  if (!(await getSetting(guild.id, "leveling", "enabled"))) return;
  const blockedChannels = await getSetting(guild.id, "leveling", "block_channels");
  if (blockedChannels != undefined)
    for (const channelID of blockedChannels) if (message.channelId == channelID) return;

  const cooldown = await getSetting(guild.id, "leveling", "cooldown");
  if (cooldown > 0) {
    const key = `${guild.id}-${author.id}`;
    const now = Date.now();
    if (now - (cooldowns.get(key) ?? 0) < cooldown * 1000) return;
    cooldowns.set(key, now);
  }

  const member = await safeMember(guild, author.id);
  const xpGain = await getSetting(guild.id, "leveling", "xp_gain");
  const difficulty = await getSetting(guild.id, "leveling", "difficulty");
  const levelChannelId = await getSetting(guild.id, "leveling", "channel");
  const xp = await getUserXp(guild.id, author.id);
  const multiplier = await getSetting(guild.id, "leveling", "global_multiplier");

  /*
  [TODO] redo to be more better.
  WHAT HAS TO BE DONE HERE:
  - find the highest role that the user has that a multiplier also has, then use that.
  - if same channel/role has multiple multipliers, it should apply the highest one.
  const multipliers = await getSetting(guild.id, "leveling", "multipliers");
  for (const mult of multipliers) {
    if (mult.channels.includes(message.channelId)) multiplier *= mult.multiplier;
    if (member.roles.cache.find(r => mult.roles.includes(r.id))) multiplier *= mult.multiplier;
  }
  */

  const newXp = multiplier * xpGain + xp;
  const newLevel = calculateLevel({ xp: newXp, difficulty });
  await setUserXp({ guild_id: guild.id, user_id: author.id, xp: newXp });
  if (newLevel <= calculateLevel({ xp, difficulty })) return;
  const avatar = author.displayAvatarURL();
  const rewards = (await getLevelRewards(guild.id))?.filter(r => r.level <= newLevel);
  const messageContent = [
    `**Congratulations, ${author.displayName}**!`,
    `You made it to **level ${newLevel}**.`,
  ];

  if (rewards && rewards.length > 0)
    for (const reward of rewards) {
      if (reward.roles && reward.roles.length > 0 && !clientMember.permissions.has("ManageRoles")) {
        await removeLevelRewards(guild.id, [reward]);
        return await errorEmbed(false, {
          client,
          title: "A level reward has been removed.",
          reason: `The bot is missing the **Manage Roles** permission.\n**Removed level reward**: ${reward.roles.map(id => id && mention(id, "ROLE")).join(", ")} at level ${reward.level}`,
          dmOwner: true,
        });
      }

      if (
        reward.channels &&
        reward.channels.length > 0 &&
        !clientMember.permissions.has("ManageChannels")
      ) {
        await removeLevelRewards(guild.id, [reward]);
        return await errorEmbed(false, {
          client,
          title: "A level reward has been removed.",
          reason: `The bot is missing the **Manage Channels** permission.\n**Removed level reward**: ${reward.channels.map(id => id && mention(id, "CHANNEL")).join(", ")} at level ${reward.level}`,
          dmOwner: true,
        });
      }

      await grantRewards(
        reward,
        member,
        (s: string) => {
          messageContent.push(s);
        },
        guild,
        author,
      );
    }

  if (!levelChannelId) return;

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${mention(author.id, "USER")} has leveled up!`),
          new TextDisplayBuilder().setContent(
            [
              ...messageContent,
              `You need **${(await getXpForNextLevel(guild.id, author.id)).toLocaleString("en-US")}** XP to level up again.`,
            ].join("\n"),
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    )
    .setAccentColor(await colorize({ user: author, avatar, hue: Sokolors.Green }));

  const channel = (await safeChannel(guild, levelChannelId)) as TextChannel;
  if (
    await channelCheck({
      channel,
      guild,
      permType: "Send",
      setting: { category: "leveling", setting: "channel" },
    })
  )
    await channel.send({ components: [container], flags: "IsComponentsV2" });
} as Event<"messageCreate">);
