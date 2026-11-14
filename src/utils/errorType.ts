import { isModError, ModErrorCode, type FeatureError, type ModActionResult } from "types";
import { dekominator } from "./kominator";
import { pluralOrNot } from "./pluralOrNot";
import type { User } from "discord.js";

/**
 * Gives you an error with the Error type.
 * @param value - Error with type unknown.
 * @returns Typed error.
 */
export function errorType(value: unknown): Error {
  if (Error.isError(value)) return value;

  try {
    const stringified = JSON.stringify(value);
    return new Error(stringified);
  } catch {
    return value as Error;
  }
}

function exceptionToFeatureError(value: unknown): FeatureError {
  const error = errorType(value);

  return {
    title: "An unknown error occurred.",
    reason: error.message,
  };
}

function modErrorToFeatureError(value: ModActionResult): FeatureError {
  const { target, action, error } = value;

  if (!error)
    throw new Error(
      `modErrorToFeatureError called with no error for tgt ${target?.id} and action ${action}`,
    );

  if (Error.isError(error)) return exceptionToFeatureError(error);

  if (error.code == ModErrorCode.CaseDoesNotExist)
    return {
      title: `You can’t edit this ${action.toLowerCase()}.`,
      reason: `The ${action.toLowerCase()} doesn’t exist.`,
    };

  if (error.code == ModErrorCode.ModeratorNotFound)
    return {
      title: `Failed to ${action.toLowerCase()}.`,
      reason: "Cannot find the moderator.",
    };

  if (error.code == ModErrorCode.MissingPermission)
    return {
      title: "The bot can’t execute this command.",
      reason: `The bot is missing the ${dekominator(
        error.permissions.map(s => `**\`${s}\`**`),
        true,
      )} ${pluralOrNot("permission", error.permissions.length)}. If you want to run this command, you might want to give the bot this permission.`,
    };

  if (error.code == ModErrorCode.ChannelDoesNotExist)
    return {
      title: "The bot can’t execute this command.",
      reason: "The provided channel does not exist!",
    };

  if (error.code == ModErrorCode.TargetNotFound)
    return {
      title: "You can’t ban this user.",
      reason: "This user doesn’t exist.",
    };

  if (error.code == ModErrorCode.AlreadyBanned)
    return {
      title: "You can’t ban this user.",
      reason: "This user is already banned.",
    };

  if (error.code == ModErrorCode.AlreadyUnbanned)
    return {
      title: "You can’t unban this user.",
      reason: "This user isn’t currently banned.",
    };

  if (error.code == ModErrorCode.TargetOutside)
    return {
      title: `You can’t ${action.toLowerCase()} ${(target as User).displayName}.`,
      reason: "This user isn’t in this server.",
    };

  if (error.code == ModErrorCode.CantModerateSelf)
    return { title: `You can’t ${action.toLowerCase()} yourself.` };

  if (error.code == ModErrorCode.CantModerateSokora)
    return { title: `You can’t ${action.toLowerCase()} Sokora.` };

  if (error.code == ModErrorCode.NotApiModeratable)
    return {
      title: `You can’t ${action.toLowerCase()} ${(target as User).displayName}.`,
      reason: [
        "The member cannot be moderated by Sokora.\n",
        "**There are three reasons as to why this error might occur:**",
        "- The member has a higher role position than the bot;",
        "- The member is an administrator;",
        "- The member is the owner of the server.",
      ].join("\n"),
    };

  if (error.code == ModErrorCode.RolePosSame || error.code == ModErrorCode.TargetRolePosHigher)
    return {
      title: `You can’t ${action.toLowerCase()} ${(target as User).displayName}.`,
      reason: `The member has ${error.code == ModErrorCode.RolePosSame ? "the same" : "a higher"} role position ${error.code == ModErrorCode.RolePosSame ? "as" : "than"} you.`,
    };

  throw new Error(`Unhandled ModError type: ${JSON.stringify(error)}`);
}

export function errorToFeature(value: unknown): FeatureError {
  return isModError(value) ? modErrorToFeatureError(value) : exceptionToFeatureError(value);
}
