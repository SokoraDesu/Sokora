import { createCase } from "database/moderation";
import type { Channel, Guild, User } from "discord.js";
import { getModError } from "utils/modError";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";

interface P {
  channel: Channel;
  moderator: User;
  guild: Guild;
  reason: string | null;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { channel, reason, guild, moderator } = options;

  const error = await getModError(["ManageRoles"], {
    channel,
    action: "LOCK",
    guild,
    moderator,
    errorOptions: { allErrors: false, botError: true, channelError: true },
  });

  if (error) return fail(errorToFeature(error));

  if (channel.isThread() || channel.isDMBased())
    return fail({
      title: "You have provided a channel that can’t be locked.",
    });

  if (!channel.permissionsFor(guild.id)?.has("SendMessages"))
    return fail({
      title: "You can’t execute this command.",
      reason: "The channel is already locked.",
    });

  // TODO (for all features)
  // promise.all everywhere
  // createCase everywhere
  const [, caseId] = await Promise.all([
    channel.permissionOverwrites.create(guild.id, {
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
    }),
    createCase(guild, channel, "LOCK", moderator, reason),
  ]);

  return ok({
    title: "Locked a channel",
    reason,
    caseId,
    error: null,
    moderator,
    guild,
    action: "LOCK",
    channel,
  });
}

export const lock = feature("mod/lock", method);
