import {
  ChannelType,
  type GuildMember,
  GuildMFALevel,
  GuildNSFWLevel,
  type GuildPremiumTier,
  GuildVerificationLevel,
  type Client,
  type Guild,
} from "discord.js";
import { client } from "botfile";
import { db, values } from "database/index";
import { getSetting } from "database/settings";
import { safeChannel, safeGuild, safeMember } from "utils/safeThings";
import { IS_CANARY } from "const";
import { as } from "types";
import { mention } from "utils/mention";
import { errorEmbed } from "embeds/errorEmbed";

export interface ServerboardOptions {
  guild: Guild;
  invite?: {
    show: boolean;
    channel: string | undefined;
  };
  roles?: boolean;
  shouldDisableButtons?: boolean;
  page?: number;
  pages?: number;
}

export interface ServerboardEntry {
  guild: Guild;
  showInvite: boolean;
  inviteChannelId: string | undefined;
}

export interface ServerboardEntryData {
  inviteChannel: string | undefined | 1;
  boostTier: GuildPremiumTier;
  owner: GuildMember;
  description: string | undefined;
  createdAt: string;
  boostCount: number;
  boosterCount: number;
  safetyLevel: "Unrestricted" | "Low" | "Mid" | "High" | "Very high";
  has2fa: boolean;
  channelCount: number;
  memberCount: number;
  textChannelCount: number;
  voiceChannelCount: number;
  nsfwLevel: "Age restricted" | "Explicit" | "Safe";
  /**
  [1st 3 role mention list, role len, role len - 3]
  */
  roles: [string[], number, number];
  iconUrl: string | undefined;
}

/**
 * Returns data for building a server embed. Values are formatted where possible, but prioritize being API-serializable.
 *
 * @param {ServerboardOptions} options
 * @returns {Promise<ServerboardEntryData>}
 */
export async function getServerboardEntry(
  options: ServerboardOptions,
): Promise<ServerboardEntryData> {
  const { guild, invite } = options;
  const { premiumTier, premiumSubscriptionCount } = guild;
  const boostCount = premiumSubscriptionCount ?? 0;
  const boosters = guild.members.cache.filter(member => member.premiumSince);
  const client = guild.client.user.id;
  const owner = await guild.fetchOwner();

  const roles = guild.roles.cache;
  const sortedRoles = [...roles].toSorted((role1, role2) => role2[1].position - role1[1].position);
  sortedRoles.pop();
  const rolesLength = sortedRoles.length;

  const channels = guild.channels.cache;

  const channelSizes = {
    text: channels.filter(channel => {
      return (
        channel.type == ChannelType.GuildText ||
        channel.type == ChannelType.GuildForum ||
        channel.type == ChannelType.GuildAnnouncement
      );
    }).size,
    voice: channels.filter(
      channel =>
        channel.type == ChannelType.GuildVoice || channel.type == ChannelType.GuildStageVoice,
    ).size,
  };

  const safetySetupString = {
    [GuildVerificationLevel.None]: "Unrestricted",
    [GuildVerificationLevel.Low]: "Low",
    [GuildVerificationLevel.Medium]: "Mid",
    [GuildVerificationLevel.High]: "High",
    [GuildVerificationLevel.VeryHigh]: "Very high",
  }[guild.verificationLevel];

  let inviteChannel: 1 | string | undefined;

  if (invite?.show) {
    const clientMember = await safeMember(guild, client);
    if (
      clientMember.permissions.has("CreateInstantInvite") &&
      clientMember.permissions.has("ManageGuild")
    ) {
      const invites = await guild.invites.fetch();
      const previousInvite = invites.find(invite => invite.inviter?.id == client);
      const id =
        invite.channel ??
        guild.channels.cache
          ?.filter(channel => channel.isTextBased() && !channel.isThread())
          ?.find(channel => channel.position == 0)?.id;

      if (id) {
        const possibleInviteChannel = await safeChannel(guild, id);

        const inviteChannelPerSe =
          possibleInviteChannel?.isTextBased() &&
          !possibleInviteChannel.isThread() &&
          !possibleInviteChannel.isDMBased()
            ? possibleInviteChannel
            : guild.rulesChannel;

        if (!inviteChannelPerSe) inviteChannel = undefined;
        else if (inviteChannelPerSe.permissionsFor(client)?.has("CreateInstantInvite"))
          inviteChannel = previousInvite
            ? previousInvite.url
            : (await inviteChannelPerSe.createInvite({ maxAge: 0, reason: "Serverboard invite" }))
                .url;
        else inviteChannel = 1;
      } else inviteChannel = 1;
    } else {
      inviteChannel = 1;
    }
  }

  return {
    owner: IS_CANARY
      ? as<GuildMember>({
          user: {
            displayName: "••••••••••••",
          },
        })
      : owner,
    createdAt: mention(guild.createdAt.valueOf(), "DEFAULT_TIMESTAMP"),
    iconUrl: IS_CANARY ? undefined : (guild.iconURL() ?? undefined),
    description: IS_CANARY ? "A guild using Sokora Canary." : (guild.description ?? undefined),
    inviteChannel,
    boostTier: premiumTier,
    safetyLevel: safetySetupString as "Unrestricted",
    nsfwLevel:
      guild.nsfwLevel == GuildNSFWLevel.Explicit
        ? "Explicit"
        : guild.nsfwLevel == GuildNSFWLevel.Safe
          ? "Safe"
          : "Age restricted",
    has2fa: guild.mfaLevel == GuildMFALevel.Elevated,
    memberCount: guild.memberCount,
    textChannelCount: channelSizes.text,
    voiceChannelCount: channelSizes.voice,
    boostCount,
    channelCount: channelSizes.text + channelSizes.voice,
    boosterCount: boosters.size,
    roles: [
      sortedRoles.slice(0, 3).map(role => mention(role[0], "ROLE")),
      rolesLength,
      Math.max(0, rolesLength - 3),
    ],
  };
}

async function listPublicServers(): Promise<
  {
    guildID: string;
    showInvite: boolean;
    inviteChannelId: string | undefined;
  }[]
> {
  if (IS_CANARY)
    return client.guilds.cache
      .keys()
      .map(guildID => {
        return {
          guildID,
          showInvite: false,
          inviteChannelId: undefined,
        };
      })
      .toArray();

  const publicGuildSet = new Set(
    values<{ guildID: string }>(
      await db`SELECT * FROM settings WHERE "key" = ${"serverboard.shown"} AND "value" = ${"true"};`,
    ).map(entry => entry.guildID),
  );

  const inviteGuildsSet = new Set(
    values<{ guildID: string }>(
      await db`SELECT * FROM settings WHERE "key" = ${"serverboard.server_invite"} AND "value" = ${"true"};`,
    ).map(entry => entry.guildID),
  );

  return Promise.all(
    [...publicGuildSet].map(async entry => {
      const inviteChannel = await getSetting(entry, "serverboard", "invite_channel");
      return {
        guildID: entry,
        showInvite: inviteGuildsSet.has(entry),
        inviteChannelId: inviteChannel?.toString(),
      };
    }),
  );
}

async function deletePublicServer(guildID: string): Promise<void> {
  try {
    await db`DELETE FROM settings WHERE "guildID" = ${guildID} AND "key" = ${"serverboard.shown"} AND "value" = ${"true"};`;
  } catch (error) {
    return await errorEmbed(true, {
      client,
      error,
      fileName: "database/settings",
    });
  }
}

/**
 * Fetches the whole serverboard for you
 * @param {Client} client Bot client.
 * @returns {ServerboardEntry[]} Sorted array of entries.
 */
export async function fetchServerboard(client: Client): Promise<ServerboardEntry[]> {
  const returnValue = await Promise.all(
    (await listPublicServers()).map(async entry => {
      try {
        return {
          guild: await safeGuild(client, entry.guildID),
          showInvite: entry.showInvite,
          inviteChannelId: entry.inviteChannelId,
        };
      } catch (error) {
        if (String(error).toLowerCase().includes("unknown guild")) {
          await deletePublicServer(entry.guildID);
          return null;
        }
        throw error;
      }
    }),
  );

  return returnValue
    .filter(entry => entry != null)
    .toSorted((a, b) => b.guild.memberCount - a.guild.memberCount);
}
