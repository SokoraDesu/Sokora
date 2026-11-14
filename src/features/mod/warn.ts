import { createCase } from "database/moderation";
import type { Guild, User } from "discord.js";
import { errorCheck } from "utils/errorCheck";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";

interface P {
  reason: string | null;
  isSilent: boolean;
  moderator: User;
  target: User;
  guild: Guild;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { reason, moderator, target, guild, isSilent } = options;

  const error = await errorCheck(["ModerateMembers"], {
    target,
    action: "WARN",
    guild,
    moderator,
    errorOptions: { allErrors: true, botError: false, outsideError: true },
  });

  if (error) return fail(errorToFeature(error));

  const caseId = await createCase(guild, target, "WARN", moderator, reason);

  return ok({
    title: `warned ${target.username}`,
    reason,
    moderator,
    target,
    error: null,
    caseId,
    guild,
    action: "WARN",
    isSilent,
  });
}

export const warn = feature("mod/warn", method);
