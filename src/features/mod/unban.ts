import { createCase } from "database/moderation";
import type { Guild, User } from "discord.js";
import { getModError } from "utils/modError";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";

interface P {
  guild: Guild;
  moderator: User;
  isSilent: boolean;
  target: User;
  reason: string | null;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { target, reason, guild, moderator, isSilent } = options;

  const error = await getModError(["BanMembers"], {
    target,
    action: "UNBAN",
    guild,
    moderator,
    errorOptions: { allErrors: false, botError: true, banCheckError: true },
  });

  if (error) return fail(errorToFeature(error));

  const [caseId] = await Promise.all([
    createCase(guild, target, "UNBAN", moderator, reason),
    guild.members.unban(target.id, reason ?? undefined),
  ]);

  return ok({
    title: "Unbanned user.",
    reason,
    isSilent,
    moderator,
    guild,
    action: "UNBAN",
    target,
    caseId,
    error: null,
  });
}

export const unban = feature("mod/unban", method);
