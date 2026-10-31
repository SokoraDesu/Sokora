import type { Guild, User } from "discord.js";
import { getModError } from "utils/modError";
import { safeMember } from "utils/safeThings";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";
import { createCase } from "database/moderation";

interface P {
  reason: string | null;
  isSilent: boolean;
  target: User;
  guild: Guild;
  moderator: User;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { target: targetUser, reason, guild, moderator, isSilent } = options;
  const target = await safeMember(guild, targetUser.id);

  const error = await getModError(["ModerateMembers"], {
    target: targetUser,
    action: "UNMUTE",
    guild,
    moderator,
    errorOptions: { allErrors: false, botError: true, outsideError: true },
  });

  if (error) return fail(errorToFeature(error));

  if (!target?.isCommunicationDisabled())
    return fail({
      title: "You can’t unmute this user.",
      reason: "The user was never muted.",
    });

  await target?.edit({ communicationDisabledUntil: null });
  const caseId = await createCase(guild, targetUser, "UNMUTE", moderator, reason);
  return ok({
    action: "UNMUTE",
    moderator,
    guild,
    target: targetUser,
    title: `Unmuted ${target.user.username}`,
    reason,
    isSilent,
    caseId,
    error: null,
  });
}

export const unmute = feature("mod/unmute", method);
