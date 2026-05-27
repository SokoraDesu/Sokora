import {
  calculateLevel,
  getLevelRewards,
  getUserXp,
  getXpForNextLevel,
  removeLevelRewards,
  setUserXp,
} from "database/leveling";
import { getSetting } from "database/settings";
import { EmbedBuilder, PermissionsBitField, type TextChannel } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { easterEggs } from "handlers/events";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { kominator } from "utils/kominator";
import { mention } from "utils/mention";
import { safeChannel, safeMember, safeRole } from "utils/safeThings";
import type { Event } from "utils/types";

const cooldowns = new Map<string, number>();
export default (async function run(message) {
  const author = message.author;
  const guild = message.guild;
  if (author.bot) return;
  if (!guild) return;

  const client = message.client;
  const clientMember = await safeMember(guild, client.user.id);
  if (await getSetting(guild.id, "easter", "enabled")) {
    const enabledEggs = (await getSetting(guild.id, "easter", "enabled_eggs")) as string;
    const allowedChannels = (await getSetting(guild.id, "easter", "allowed_channels")) as string;

    if (!allowedChannels || kominator(allowedChannels).includes(message.channel.id))
      for (const easterEgg of easterEggs) {
        if (!(!enabledEggs || kominator(enabledEggs).includes(easterEgg.name))) continue;
        try {
          if (typeof easterEgg.run == "function" && Math.random() <= 0.15)
            await easterEgg.run(message);
        } catch (error) {
          return await errorEmbed({
            client,
            error,
            title: `Error running easter egg ${easterEgg.name}.`,
            log: true,
            forward: true,
            fileName: "messageCreate.ts",
          });
        }
      }
  }

  if (!(await getSetting(guild.id, "leveling", "enabled"))) return;
  const blockedChannels = (await getSetting(guild.id, "leveling", "block_channels")) as string;
  if (blockedChannels != undefined)
    for (const channelID of kominator(blockedChannels)) if (message.channelId == channelID) return;

  const cooldown = (await getSetting(guild.id, "leveling", "cooldown")) as number;
  if (cooldown > 0) {
    const key = `${guild.id}-${author.id}`;
    const now = Date.now();
    if (now - (cooldowns.get(key) ?? 0) < cooldown * 1000) return;
    cooldowns.set(key, now);
  }

  const xpGain = (await getSetting(guild.id, "leveling", "xp_gain")) as number;
  const difficulty = (await getSetting(guild.id, "leveling", "difficulty")) as number;
  const levelChannelId = await getSetting(guild.id, "leveling", "channel");
  const xp = await getUserXp(guild.id, author.id);
  const newXp = xp + xpGain;
  const newLevel = calculateLevel({ xp: newXp, difficulty });
  await setUserXp(guild.id, author.id, newXp);
  if (newLevel <= calculateLevel({ xp, difficulty })) return;
  const avatar = author.displayAvatarURL();
  const rewards = (await getLevelRewards(guild.id))?.filter(r => r.level <= newLevel);
  const messageContent = [
    `**Congratulations, ${author.displayName}**!`,
    `You made it to **level ${newLevel}**.`,
  ];

  if (rewards && rewards.length > 0)
    for (const reward of rewards) {
      const member = await safeMember(guild, author.id);
      if (!reward.channel) {
        if (!clientMember.permissions.has("ManageRoles")) {
          await removeLevelRewards(guild.id, [reward]);
          return await errorEmbed({
            client,
            title: "A level reward has been removed.",
            reason: `The bot is missing the **Manage Roles** permission.\n**Removed level reward**: ${mention(reward.id, "ROLE")} at level ${reward.level}`,
            dmOwner: true,
          });
        }

        const role = await safeRole(guild, reward.id);
        await member.roles.add(role);
        if (!member.roles.cache.has(role.id))
          messageContent.push(
            `**You've been rewarded the ${mention(role.id, "ROLE")} role!** Congrats.`,
          );

        continue;
      }

      if (!clientMember.permissions.has("ManageChannels")) {
        await removeLevelRewards(guild.id, [reward]);
        return await errorEmbed({
          client,
          title: "A level reward has been removed.",
          reason: `The bot is missing the **Manage Channels** permission.\n**Removed level reward**: ${mention(reward.id, "CHANNEL")} at level ${reward.level}`,
          dmOwner: true,
        });
      }

      const channel = await safeChannel(guild, reward.id);
      if (
        !channel.isTextBased() ||
        channel.isDMBased() ||
        channel.isVoiceBased() ||
        channel.isThread()
      )
        continue;

      await channel.permissionOverwrites.set([
        { id: author.id, allow: [PermissionsBitField.Flags.ViewChannel] },
      ]);

      if (!channel.permissionsFor(member).has("ViewChannel"))
        messageContent.push(
          `**You've been rewarded access to the ${mention(channel.id, "CHANNEL")}> channel!** Congrats.`,
        );
    }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${author.displayName} leveled up!`,
      iconURL: avatar,
    })
    .setDescription(
      [
        ...messageContent,
        `You need **${(await getXpForNextLevel(guild.id, author.id)).toLocaleString("en-US")}** XP to level up again.`,
      ].join("\n"),
    )
    .setTimestamp()
    .setColor(await colorize({ user: author, avatar, hue: Sokolors.Green }));

  if (levelChannelId) {
    const channel = (await safeChannel(guild, `${levelChannelId}`)) as TextChannel;
    if (
      await channelCheck({
        channel,
        guild,
        permType: "Send",
        setting: { category: "leveling", setting: "channel" },
      })
    )
      await channel.send({ embeds: [embed], content: mention(author.id, "USER") });
  }
} as Event<"messageCreate">);
