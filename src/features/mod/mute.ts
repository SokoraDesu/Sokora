import { createCase } from "database/moderation";
import type { Guild, User } from "discord.js";
import { errorCheck } from "utils/errorCheck";
import type { FeatureOutput, ModActionResult } from "types";
import { MILLISEC_28D } from "utils/constants";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";
import { safeMember } from "utils/safeThings";

interface P {
  guild: Guild;
  durationMillisec: number;
  reason: string | null;
  isSilent: boolean;
  moderator: User;
  target: User;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { moderator, guild, target, durationMillisec, isSilent, reason } = options;

  const error = await errorCheck(["ModerateMembers"], {
    target,
    action: "MUTE",
    guild,
    moderator,
    errorOptions: { allErrors: true, botError: true, outsideError: true },
  });

  if (error) return fail(errorToFeature(error));

  if (durationMillisec > MILLISEC_28D || durationMillisec <= 0)
    return fail({
      title: `You can’t mute ${target.username}.`,
      reason: "The duration is invalid or is above the 28 day limit.",
    });

  if ((await safeMember(guild, target.id)).isCommunicationDisabled())
    return fail({
      title: `You can’t mute ${target.username}.`,
      reason: "The user is already muted.",
    });

  const time = Temporal.Now.instant()
    .add({ milliseconds: durationMillisec })
    .toString({ smallestUnit: "millisecond" });

  const member = await safeMember(guild, target.id);

  const [caseId] = await Promise.all([
    createCase(guild, target, "MUTE", moderator, reason),
    member.edit({ communicationDisabledUntil: time, reason: reason ?? undefined }),
  ]);

  return ok({
    title: `Muted ${target.username}.`,
    reason,
    caseId,
    isSilent,
    moderator,
    guild,
    target,
    action: "MUTE",
    error: null,
  });
}

export const mute = feature("mod/mute", method);
