// TODO: this is worse than before, not better
// i mean technically better but awful CQ

import { getCase, type ModType } from "database/moderation";
import {
  PermissionsBitField,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  ContainerBuilder,
  type PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type User,
} from "discord.js";
import ms from "enhanced-ms";
import { mention } from "utils/mention";
import { safeMember } from "utils/safeThings";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import {
  type ModErrorOptions,
  type ModEmbedOptions,
  ModErrorCode,
  type ModActionError,
  as,
} from "types";
import { lacksPerm } from "../commands/permcheck";

/**
 * Checks for errors in moderation commands.
 * @param permission The permission that the command requires. If the bot doesn't have it, it errors.
 * (TODO: might have to check for USER perms besides bot perms)
 * TODO 2: move this elsewhere, modEmbed file is for modEmbed
 * @param options Error options.
 * @returns `true` if something goes wrong. `false` otherwise.
 */
export async function getModError(
  desiredPermissionArray: (keyof typeof PermissionFlagsBits)[],
  options: ModErrorOptions & { guild: Guild; moderator: User; action: ModType },
): Promise<ModActionError | undefined> {
  const { guild, moderator, previousCaseId, target, channel, action, errorOptions } = options;
  const { allErrors, botError, channelError, outsideError, banCheckError } = errorOptions;

  const r = (error: ModActionError["error"]): ModActionError => {
    return as<ModActionError>({
      guild,
      moderator,
      previousCaseId,
      target,
      channel,
      action,
      error,
    });
  };

  if (previousCaseId) {
    const previousCase = await getCase(guild.id, previousCaseId);
    if (
      previousCase.length === 0 ||
      previousCase[0].target_id != target?.id ||
      previousCase[0].type != action
    )
      return r({ code: ModErrorCode.CaseDoesNotExist });
  }

  if (!moderator) return r({ code: ModErrorCode.ModeratorNotFound });

  const member = await safeMember(guild, moderator.id);
  const client = await safeMember(guild, guild.client.user.id);

  const desiredPermissions = new PermissionsBitField(desiredPermissionArray);
  if (allErrors) desiredPermissions.add("ModerateMembers");
  const clientLacks = lacksPerm(client.permissions, desiredPermissions);
  console.log("ARR", desiredPermissionArray, "PRODUCES", desiredPermissions.toArray());

  if (botError && clientLacks.length > 0)
    return r({ code: ModErrorCode.MissingPermission, permissions: clientLacks });

  if (channelError) {
    if (!channel)
      return r({
        code: ModErrorCode.ChannelDoesNotExist,
      });

    if (channel.isDMBased()) return;
    if (!channel.permissionsFor(client).has("ViewChannel"))
      return r({
        code: ModErrorCode.MissingPermission,
        permissions: ["ViewChannel"],
      });
  }

  const memberLacks = lacksPerm(member.permissions, desiredPermissions);

  if (memberLacks.length > 0)
    return r({
      code: ModErrorCode.MissingPermission,
      permissions: memberLacks,
    });

  if (banCheckError) {
    if (!target)
      return r({
        code: ModErrorCode.TargetNotFound,
      });

    const isBanned = (await guild.bans.fetch()).has(target.id);
    if (isBanned && action == "BAN")
      return r({
        code: ModErrorCode.AlreadyBanned,
      });

    if (!isBanned && action == "UNBAN")
      return r({
        code: ModErrorCode.AlreadyUnbanned,
      });
  }

  if (!allErrors || !target || !action) return;

  if (outsideError && !target)
    // target SHOULD exist in server
    return r({
      code: ModErrorCode.TargetOutside,
    });

  if (!target) return;

  if (target.id == moderator.id)
    return r({
      code: ModErrorCode.CantModerateSelf,
    });

  if (target.id == client.user.id)
    return r({
      code: ModErrorCode.CantModerateSokora,
    });

  const targetMember = await safeMember(guild, target.id);

  if (!targetMember.moderatable)
    return r({
      code: ModErrorCode.NotApiModeratable,
    });

  const highestModPos = member.roles.highest.position;
  const highestTargetPos = targetMember.roles.highest.position;

  if (highestModPos <= highestTargetPos && member.id != guild.ownerId) {
    const isSamePos: boolean = highestModPos == highestTargetPos;
    {
      return r({
        code: isSamePos ? ModErrorCode.RolePosSame : ModErrorCode.TargetRolePosHigher,
      });
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

function produceVerb(action: ModType, slowdownValue?: number): string {
  if (action == "SLOWDOWN" && slowdownValue == 0) return "Removed slowdown";

  const verbAction = (
    {
      MUTE: "Muted",
      UNMUTE: "Unmuted",
      WARN: "Warned",
      KICK: "Kicked",
      BAN: "Banned",
      UNBAN: "Unbanned",
      LOCK: "Locked",
      UNLOCK: "Unlocked",
      SLOWDOWN: "Slowed",
      CLEAR: "Cleared",
    } as Record<typeof action, string>
  )[action];

  return verbAction;
}

/**
 * Sends a container containing information about a moderation action.
 * @param options Options
 * @param reason Reason for the moderation action.
 * @returns A container with action info (or an errorEmbed if something goes wrong).
 */
async function buildModEmbed(modAction: ModEmbedOptions): Promise<ContainerBuilder> {
  const { guild, target, previousCaseId, caseId, action, channel, customText } = modAction;

  // TODO: get this to somehow produce removed slowdown
  const verb = produceVerb(action);
  const generalValues = produceGeneralValues(modAction);
  const serverAvatar = (guild.icon ? guild.iconURL() : undefined) ?? undefined;
  const avatar = target ? target.displayAvatarURL() : serverAvatar;
  let title = `${previousCaseId ? "Edited a " : ""}${previousCaseId ? verb?.toLowerCase() : verb}${previousCaseId ? " on" : ""} ${target ? mention(target.id, "USER") : ""}`;

  if (previousCaseId ?? caseId) title += `  •  #${previousCaseId ?? caseId}`;

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

async function buildDmModEmbed(modAction: ModEmbedOptions): Promise<ContainerBuilder> {
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

/**
 * Creates an embed for a moderation action and sends it to the current channel as well as the log channel (if any). Optionally sends the user a DM if needed.
 *
 * @param options
 * @param shouldDm
 */
export async function modEmbed(
  options: ModEmbedOptions & { shouldDm?: boolean; interaction: ChatInputCommandInteraction },
): Promise<void> {
  const container = await buildModEmbed(options);

  await logChannel(
    options.guild,
    { components: [container], flags: "IsComponentsV2" },
    options.shouldDm,
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

  await options.interaction.reply({
    flags: options.isSilent ? ["IsComponentsV2", "Ephemeral"] : "IsComponentsV2",
    components: [container],
  });
}
