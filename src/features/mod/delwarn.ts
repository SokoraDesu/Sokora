import { listUserCases, removeCase } from "database/moderation";
import type { Guild, User } from "discord.js";
import { getModError } from "utils/modError";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";
import { mention } from "utils/mention";

interface P {
  target: User;
  moderator: User;
  guild: Guild;
  isSilent: boolean;
  warnId: number;
  reason: string | null;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { target, warnId, guild, reason, moderator, isSilent } = options;

  const error = await getModError(["ModerateMembers"], {
    target,
    guild,
    moderator,
    // TODO(v0.4)(@ZakaHaceCosas): document that warn is used for delwarn too, (after adding a moderator’s docsite)
    action: "WARN",
    errorOptions: { allErrors: true, botError: false },
  });

  if (error) return fail(errorToFeature(error));

  const warns = await listUserCases(guild.id, target.id, "WARN");
  const newWarns = warns.filter(warn => warn.id != warnId);

  if (newWarns.length == warns.length)
    return fail({
      title: `There is no warning with the id of ${warnId}.`,
    });

  await removeCase(guild.id, warnId);

  return ok({
    title: `Removed a warning from ${mention(target.id, "USER")}`,
    // dmTitle: "Your warning has been removed",
    //    isSilent,
    reason,
    moderator,
    guild,
    target,
    action: "DELWARN" as "WARN",
    error: null,
    caseId: warnId,
    isSilent,
  });
}

export const delwarn = feature("mod/delwarn", method);
