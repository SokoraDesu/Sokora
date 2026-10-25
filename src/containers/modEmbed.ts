// TODO: this is worse than before, not better
// i mean technically better but awful CQ

import { client as originalClient } from "botfile";
import { getCase } from "database/moderation";
import {
  PermissionsBitField,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  ContainerBuilder,
  type PermissionFlagsBits,
} from "discord.js";
import ms from "enhanced-ms";
import { mention } from "utils/mention";
import { safeMember } from "utils/safeThings";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { type ModActionPayload, type ModActionResult, type ModError, ModErrorCode } from "types";
import { lacksPerm } from "../commands/permcheck";

type ErrorOptions = Partial<ModActionPayload> & {
  errorOptions: {
    allErrors: boolean;
    botError: boolean;
    channelError?: boolean;
    outsideError?: boolean;
    banCheckError?: boolean;
  };
};

type ModEmbedOptions = ModActionResult & {
  isSilent?: boolean;
  reason?: string | null;
  customText?: {
    logTitle: string;
    dmTitle?: string;
  };
};

/**
 * Checks for errors in moderation commands.
 * @param permission The permission that the command requires. If the bot doesn't have it, it errors.
 * (TODO: might have to check for USER perms besides bot perms)
 * @param options Error options.
 * @returns `true` if something goes wrong. `false` otherwise.
 */
export async function getModError(
  desiredPermissionArray: (keyof typeof PermissionFlagsBits)[],
  options: ErrorOptions,
): Promise<ModError | undefined> {
  const { guild, moderator, previousCaseId, target, channel, action, errorOptions } = options;
  const { allErrors, botError, channelError, outsideError, banCheckError } = errorOptions;

  if (!guild) return;

  if (previousCaseId) {
    const previousCase = await getCase(guild.id, previousCaseId);
    if (
      previousCase.length === 0 ||
      previousCase[0].user_id != target?.id ||
      previousCase[0].type != action
    )
      return { code: ModErrorCode.CaseDoesNotExist };
  }

  if (!moderator) return { code: ModErrorCode.ModeratorNotFound };

  const member = await safeMember(guild, moderator.id);
  const client = await safeMember(guild, originalClient.user.id);

  const desiredPermissions = new PermissionsBitField(desiredPermissionArray);
  if (allErrors) desiredPermissions.add("ModerateMembers");
  const clientLacks = lacksPerm(client.permissions, desiredPermissions);

  if (botError && clientLacks.length > 0) {
    return { code: ModErrorCode.MissingPermission, permissions: clientLacks };
  }

  if (channelError) {
    if (!channel) {
      return {
        code: ModErrorCode.ChannelDoesNotExist,
      };
    }

    if (channel.isDMBased()) return;
    if (!channel.permissionsFor(client).has("ViewChannel")) {
      return {
        code: ModErrorCode.MissingPermission,
        permissions: ["ViewChannel"],
      };
    }
  }

  const memberLacks = lacksPerm(member.permissions, desiredPermissions);

  if (memberLacks.length > 0) {
    return {
      code: ModErrorCode.MissingPermission,
      permissions: memberLacks,
    };
  }

  if (banCheckError) {
    if (!target) {
      return {
        code: ModErrorCode.TargetNotFound,
      };
    }

    const isBanned = (await guild.bans.fetch()).has(target.id);
    if (isBanned && action == "BAN") {
      return {
        code: ModErrorCode.AlreadyBanned,
      };
    }

    if (!isBanned && action == "UNBAN") {
      return {
        code: ModErrorCode.AlreadyUnbanned,
      };
    }
  }

  if (!allErrors || !target || !action) return;

  if (outsideError && !target) {
    // target SHOULD exist in server
    return {
      code: ModErrorCode.TargetOutside,
    };
  }

  if (!target) return;

  if (target.id == moderator.id) {
    return {
      code: ModErrorCode.CantModerateSelf,
    };
  }

  if (target.id == client.user.id) {
    return {
      code: ModErrorCode.CantModerateSokora,
    };
  }

  const targetMember = await safeMember(guild, target.id);

  if (!targetMember.moderatable) {
    return {
      code: ModErrorCode.NotApiModeratable,
    };
  }

  const highestModPos = member.roles.highest.position;
  const highestTargetPos = targetMember.roles.highest.position;

  if (highestModPos <= highestTargetPos && member.id != guild.ownerId) {
    const isSamePos: boolean = highestModPos == highestTargetPos;
    {
      return {
        code: isSamePos ? ModErrorCode.RolePosSame : ModErrorCode.TargetRolePosHigher,
      };
    }
  }

  return;
}

function produceGeneralValues(modAction: ModEmbedOptions): string[] {
  const { moderator, reason, duration, channel } = modAction;
  const generalValues = [`**Moderator**: ${moderator.displayName}`];
  if (reason) generalValues.push(`**Reason**: ${reason}`);
  if (duration) generalValues.push(`**Duration**: ${ms(duration, "fullPrecision")}`);
  if (channel) generalValues.push(`**Channel**: ${mention(channel.id, "CHANNEL")}`);
  return generalValues;
}

/**
 * Sends a container containing information about a moderation action.
 * @param options Options
 * @param reason Reason for the moderation action.
 * @returns A container with action info (or an errorEmbed if something goes wrong).
 */
export async function buildModEmbed(modAction: ModEmbedOptions): Promise<ContainerBuilder> {
  const { guild, target, previousCaseId, caseId, action, channel, customText } = modAction;

  const generalValues = produceGeneralValues(modAction);
  const serverAvatar = (guild.icon ? guild.iconURL() : undefined) ?? undefined;
  const avatar = target ? target.displayAvatarURL() : serverAvatar;
  let title = `${previousCaseId ? "Edited a " : ""}${previousCaseId ? action?.toLowerCase() : action}${previousCaseId ? " on" : ""}${target ? mention(target.id, "USER") : ""}`;

  if (previousCaseId ?? caseId) {
    title += `  •  #${previousCaseId ?? caseId}`;
  }

  const textDisplayComponents = [
    new TextDisplayBuilder().setContent(`**${customText?.logTitle ?? title}**`),
    new TextDisplayBuilder().setContent(generalValues.join("\n")),
    new TextDisplayBuilder().setContent(
      `-# ${target ? `User ID: ${target.id}` : `Channel ID: ${channel}`} • ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`,
    ),
  ];

  const container = new ContainerBuilder().setAccentColor(await colorize({ hue: Sokolors.Green }));
  if (avatar)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(textDisplayComponents)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );
  else container.addTextDisplayComponents(textDisplayComponents);

  return container;
}

export async function buildDmModEmbed(modAction: ModEmbedOptions): Promise<ContainerBuilder> {
  const { guild, action, customText } = modAction;
  const generalValues = produceGeneralValues(modAction);

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        customText?.dmTitle ?? `**You got ${action?.toLowerCase()} from ${guild.name}**`,
      ),
      new TextDisplayBuilder().setContent(generalValues.join("\n")),
      new TextDisplayBuilder().setContent(`-# ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));
}

export async function useModEmbed(options: ModEmbedOptions, shouldDm = false): Promise<void> {
  const container = await buildModEmbed(options);

  await logChannel(
    options.guild,
    { components: [container], flags: "IsComponentsV2" },
    shouldDm,
    options.target
      ? {
          isSilent: options.isSilent ?? false,
          user: options.target,
          options: {
            components: [await buildDmModEmbed(options)],
            flags: "IsComponentsV2",
          },
        }
      : undefined,
  );
}
