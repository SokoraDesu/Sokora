import { createCase } from "database/moderation";
import type { Guild, User } from "discord.js";
import { errorCheck } from "utils/errorCheck";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";
import { safeMember } from "utils/safeThings";

interface P {
  target: User;
  moderator: User;
  reason: string | null;
  guild: Guild;
  isSilent: boolean;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { target, guild, reason, moderator, isSilent } = options;

  const error = await errorCheck(["KickMembers"], {
    target,
    guild,
    moderator,
    action: "KICK",
    errorOptions: { allErrors: true, botError: true, outsideError: true },
  });

  if (error) return fail(errorToFeature(error));

  const member = await safeMember(guild, target.id);

  const [caseId] = await Promise.all([
    createCase(guild, target, "KICK", moderator, reason),
    member.kick(reason ?? undefined),
  ]);

  return ok({
    title: `Kicked ${target.username}.`,
    reason,
    moderator,
    guild,
    action: "KICK",
    target,
    isSilent,
    error: null,
    caseId,
  });
}

export const kick = feature("mod/kick", method);
