import { createCase } from "database/moderation";
import type {
  NewsChannel,
  PrivateThreadChannel,
  PublicThreadChannel,
  StageChannel,
  TextChannel,
  User,
  VoiceChannel,
} from "discord.js";
import { errorCheck } from "utils/errorCheck";
import type { FeatureOutput, ModActionResult } from "types";
import { errorToFeature } from "utils/errorType";
import { feature, type MethodParameters } from "utils/feature";
import { mention } from "utils/mention";
import { pluralOrNot } from "utils/pluralOrNot";

interface P {
  target:
    | NewsChannel
    | StageChannel
    | TextChannel
    | PublicThreadChannel
    | PrivateThreadChannel
    | VoiceChannel;
  reason: string | null;
  moderator: User;
  amount: number;
  targetUser: User | undefined;
}

async function method(
  ...parameters: MethodParameters<P, ModActionResult>
): Promise<FeatureOutput<ModActionResult>> {
  const [ok, fail, options] = parameters;
  const { target, amount, targetUser, reason, moderator } = options;

  const error = await errorCheck(["ManageMessages"], {
    channel: target,
    guild: target.guild,
    moderator,
    action: "CLEAR",
    errorOptions: { allErrors: false, botError: true, channelError: true },
  });

  if (error) return fail(errorToFeature(error));

  if (amount > 100)
    return fail({
      title: "You can only clear up to 100 messages at a time.",
    });

  if (amount < 1) return fail({ title: "You must clear at least 1 message." });

  if (!target.isTextBased() || target.isDMBased())
    return fail({
      title: "You have provided a channel that can’t have messages to clear.",
    });

  let deletedAmount = 0;

  if (targetUser) {
    const userMessages = (await target.messages.fetch({ limit: 100 }))
      .filter(m => m.author.id == targetUser.id && !m.partial)
      .first(amount);

    if (userMessages.length === 0)
      return fail({
        title: "No messages found.",
        reason: "No messages from this user were found in the recent history.",
      });

    await target.bulkDelete(userMessages, true);
    deletedAmount = userMessages.length;
  } else {
    await target.bulkDelete(amount, true).then(messages => (deletedAmount = messages.size));

    if (deletedAmount == 0)
      return fail({
        title: "No messages found.",
        reason: "No messages were found in the recent history.",
      });
  }

  const caseId = await createCase(target.guild, target, "CLEAR", moderator, reason);

  return ok({
    error: null,
    guild: target.guild,
    action: "CLEAR",
    target,
    caseId,
    moderator,
    title: `Cleared ${deletedAmount} ${pluralOrNot("message", deletedAmount)}${targetUser ? ` from ${mention(targetUser.id, "USER")}` : ""}`,
    reason,
  });
}

export const clear = feature("mod/clear", method);
