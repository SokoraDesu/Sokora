import { resetSetting } from "database/settings";
import {
  ContainerBuilder,
  EmbedBuilder,
  NewsChannel,
  SectionBuilder,
  SeparatorBuilder,
  StageChannel,
  TextChannel,
  TextDisplayBuilder,
  ThumbnailBuilder,
  VoiceChannel,
  type Guild,
} from "discord.js";
import { logChannel } from "utils/logChannel";
import { pagedButtons } from "utils/pagination";
import { safeChannel, safeMember } from "utils/safeThings";
import { colorize, Sokolors } from "../colorize";
import { dotCheck } from "../dotCheck";
import { mention } from "../mention";
import { pluralOrNot } from "../pluralOrNot";

type Options = {
  guild: Guild;
  invite?: {
    show: boolean;
    channel: string | null;
  };
  roles?: boolean;
  page?: number;
  pages?: number;
  disableButtons?: boolean;
};

/**
 * Gives you a CONTAINER containing information about the guild.
 * @param options Options of the embed.
 * @returns Container that contains the guild info.
 */
export async function serverEmbed(options: Options): Promise<ContainerBuilder> {
  const { page, pages, guild, invite, disableButtons } = options;
  const { premiumTier: boostTier, premiumSubscriptionCount: boostCount } = guild;
  const boosters = guild.members.cache.filter(member => member.premiumSince);
  const client = guild.client.user.id;
  const owner = await guild.fetchOwner();
  const icon = guild.iconURL()!;

  const roles = guild.roles.cache;
  const sortedRoles = [...roles].sort((role1, role2) => role2[1].position - role1[1].position);
  sortedRoles.pop();
  const rolesLength = sortedRoles.length;

  const channels = guild.channels.cache;
  const channelSizes = {
    text: channels.filter(channel => channel.type == 0 || channel.type == 15 || channel.type == 5)
      .size,
    voice: channels.filter(channel => channel.type == 2 || channel.type == 13).size,
  };
  const channelCount = channelSizes.text + channelSizes.voice;

  const generalValues = [
    `Owned by **${owner.user.displayName}**`,
    `Created on **${mention(guild.createdAt.valueOf(), "DEFAULT_TIMESTAMP")}**`,
  ].join("\n");

  const vl = guild.verificationLevel;
  const nsfw = guild.nsfwLevel;
  const safetyValues: (string | null)[] = [
    `**${vl == 0 ? "Unrestricted" : vl == 1 ? "Low" : vl == 2 ? "Mid" : vl == 3 ? "High" : "Very high"}** level`,
    `**${guild.mfaLevel == 1 ? "No" : "Has"}** 2FA`,
  ];

  if (nsfw != 0)
    safetyValues.push(`**${nsfw == 1 ? "Explicit" : nsfw == 2 ? "Safe" : "Age restricted"}**`);

  const statValues: (string | null)[] = [
    `**${guild.memberCount?.toLocaleString("en-US")}** members`,
    channelSizes.voice > 0
      ? `**${channelCount}** ${pluralOrNot("channel", channelCount)} • **${channelSizes.text}** text and **${channelSizes.voice}** voice`
      : `**${channelCount}** text ${pluralOrNot("channel", channelCount)}`,
  ];

  if (boostTier)
    statValues.push(
      `${!boostTier ? "**No** level" : `Level **${boostTier}**`} • **${boostCount}** ${pluralOrNot("boost", boostCount!)} • **${boosters.size}** ${pluralOrNot("booster", boosters.size)}`,
    );

  if (options.roles)
    statValues.push(
      `**${roles.size - 1}** ${pluralOrNot("role", roles.size - 1)} • ${
        roles.size == 1
          ? "*None*"
          : `${sortedRoles
              .slice(0, 3)
              .map(role => mention(role[0], "ROLE"))
              .join(" • ")}${rolesLength > 3 ? ` and **${rolesLength - 3}** more` : ""}`
      }`,
    );

  const dot = dotCheck({ string: icon, doubleSpace: true });
  const container = new ContainerBuilder();
  const start = new TextDisplayBuilder().setContent(
    [
      `## ${pages && pages > 1 ? `#${page! + 1}  •  ` : dot}${guild.name}`,
      generalValues,
      safetyValues.join(" • "),
    ].join("\n"),
  );

  if (icon)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(start)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)),
    );
  else container.addTextDisplayComponents(start);

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (guild.description)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${guild.description}`),
    );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statValues.join("\n")));
  if (invite?.show) {
    async function noPerms(channel?: NewsChannel | TextChannel | StageChannel | VoiceChannel) {
      await resetSetting(guild.id, "serverboard", "server_invite");
      await resetSetting(guild.id, "serverboard", "invite_channel");
      const errEmbed = new EmbedBuilder()
        .setAuthor({
          name: `${dot}Serverboard is misconfigured in your server!`,
          iconURL: icon,
        })
        .setFields({
          name: "⁉️ • What happened",
          value: [
            "Sokora does not have the **Create Invite** and **Manage Server** permissions to create an invitation, but `serverboard.server_invite` is enabled.",
            `Please give Sokora the permission${channel ? ` for ${channel.name}` : ""} and enable the settings again in **/settings serverboard**.`,
          ].join("\n"),
        })
        .setColor(await colorize({ hue: Sokolors.Yellow }));

      await logChannel(guild, { embeds: [errEmbed] }, true, {
        silent: false,
        user: owner.user,
        options: {
          embeds: [
            errEmbed.setFooter({ text: `This is coming from ${guild.name} • ID: ${guild.id}` }),
          ],
        },
      });

      return container;
    }

    const clientMember = await safeMember(guild, client);
    if (
      !clientMember.permissions.has("CreateInstantInvite") ||
      !clientMember.permissions.has("ManageGuild")
    )
      return noPerms();

    const invites = await guild.invites.fetch();
    const previousInvite = invites.find(invite => invite.inviter?.id == client);
    const possibleInviteChannel = await safeChannel(
      guild,
      invite.channel ??
        guild.channels.cache
          .filter(channel => channel.isTextBased() && !channel.isThread())
          .find(channel => channel.position == 0)!.id,
    );

    const inviteChannel =
      possibleInviteChannel &&
      possibleInviteChannel.isTextBased() &&
      !possibleInviteChannel.isThread() &&
      !possibleInviteChannel.isDMBased()
        ? possibleInviteChannel
        : guild.rulesChannel;

    if (!inviteChannel) return container;
    if (!inviteChannel.permissionsFor(client)?.has("CreateInstantInvite"))
      return noPerms(inviteChannel);

    const inviteUrl = previousInvite
      ? previousInvite.url
      : await inviteChannel.createInvite({ maxAge: 0, reason: "Serverboard invite" });

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`This server allows you to join from here! ${inviteUrl}`),
    );
  }

  if (pages && pages > 1)
    container.addActionRowComponents(pagedButtons(pages, page, disableButtons));

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Server ID: ${guild.id}`))
    .setAccentColor(await colorize({ avatar: icon, hue: Sokolors.Blue }));

  return container;
}
