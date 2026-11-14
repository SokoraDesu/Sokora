import { createCase } from "database/moderation";
import type { Channel, Guild, User } from "discord.js";
import { errorCheck } from "utils/errorCheck";
import ms from "enhanced-ms";
import type { FeatureOutput, ModActionResult } from "types";
import { MILLISEC_6H } from "utils/constants";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";

interface P {
  guild: Guild;
  moderator: User;
  timeMillisec: number;
  reason: string | null;
  channel: Channel;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { timeMillisec, reason, channel, guild, moderator } = options;

  const error = await errorCheck(["ManageChannels"], {
    channel,
    action: "SLOWDOWN",
    guild,
    moderator,
    errorOptions: { allErrors: false, botError: true, channelError: true },
  });

  if (error) return fail(errorToFeature(error));

  if (timeMillisec > MILLISEC_6H)
    return fail({
      title: "You have provided a duration longer than 6 hours.",
    });

  if (!channel.isTextBased() || channel.isDMBased())
    return fail({
      title: "You have provided a channel that can’t be slowed down.",
    });

  const [caseId] = await Promise.all([
    createCase(guild, channel, "SLOWDOWN", moderator, reason),
    channel.setRateLimitPerUser(timeMillisec / 1000, reason ?? undefined),
  ]);

  return ok({
    title: timeMillisec
      ? `Set the slowdown to ${ms(timeMillisec, "fullPrecision")}`
      : "Removed the slowdown",
    reason,
    moderator,
    target: channel,
    guild,
    error: null,
    action: "SLOWDOWN",
    caseId,
    expiresAt: timeMillisec
      ? Temporal.Now.instant().add({
          milliseconds: timeMillisec,
        })
      : undefined,
  });
}

export const slowdown = feature("mod/slowdown", method);
