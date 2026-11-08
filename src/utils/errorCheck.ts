import { type ModType, getCase } from "database/moderation";
import { type PermissionFlagsBits, type Guild, type User, PermissionsBitField } from "discord.js";
import { type ModErrorOptions, type ModActionError, as, ModErrorCode } from "types";
import { lacksPerm } from "../commands/permcheck";
import { safeMember } from "./safeThings";

/**
 * Checks for errors in moderation commands.
 * @param permission - The permission that the command requires. If the bot doesn't have it, it errors.
 * (TODO(v0.4): might have to check for moderator perms besides bot perms)
 * @param options - Error options.
 * @returns `true` if something goes wrong. `false` otherwise.
 */
export async function errorCheck(
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

  if (!targetMember.moderatable)
    return r({
      code: ModErrorCode.NotApiModeratable,
    });

  return;
}
