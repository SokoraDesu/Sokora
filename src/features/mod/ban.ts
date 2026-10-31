import { client } from "botfile";
import { createCase } from "database/moderation";
import type { Guild, User } from "discord.js";
import { getModError } from "embeds/modEmbed";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";
import { safeMembers } from "utils/safeThings";
import { scheduleUnban } from "utils/unbanScheduler";

interface P {
  isSilent: boolean;
  guild: Guild;
  /** Moderator who bans. */
  moderator: User;
  /** Banned user. */
  target: User;
  /** Duration of the ban in millisec. Leave empty for non-expiring bans. */
  durationMillisec: number | undefined;
  /** Reason of the ban. */
  reason: string | null;
  /** Time-frame to delete messages from in **seconds**, not millisec. */
  delMessageSeconds: number | undefined;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { guild, target, isSilent, moderator, durationMillisec, reason, delMessageSeconds } =
    options;

  const isMember = (await safeMembers(guild)).has(target.id);

  const error = await getModError(["BanMembers"], {
    target,
    guild,
    moderator,
    action: "BAN",
    errorOptions: {
      allErrors: isMember,
      banCheckError: true,
      botError: true,
    },
  });

  if (error) return fail(errorToFeature(error));

  await guild.members.ban(target.id, {
    reason: reason ?? undefined,
    deleteMessageSeconds: delMessageSeconds,
  });

  const caseId = await createCase(guild, target, "BAN", moderator, reason);

  if (durationMillisec)
    scheduleUnban(client, guild, target.id, moderator.id, durationMillisec, caseId);

  return ok({
    error: null,
    target,
    guild,
    moderator,
    caseId,
    action: "BAN",
    duration: durationMillisec ?? undefined,
    shouldDm: isMember,
    expiresAt: durationMillisec ? new Date(durationMillisec) : undefined,
    isSilent,
    reason,
    title: `Banned ${target.username}.`,
  });
}

export const ban = feature("mod/ban", method);
