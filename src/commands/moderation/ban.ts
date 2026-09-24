import { getSetting } from "database/settings";
import {
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { errorCheck, modEmbed } from "embeds/modEmbed";
import ms from "enhanced-ms";
import { safeMembers } from "utils/safeThings";
import { scheduleUnban } from "utils/unbanScheduler";

export const data = new SlashCommandSubcommandBuilder()
  .setName("ban")
  .setDescription("Bans a user.")
  .addUserOption(user =>
    user
      .setName("user")
      .setDescription("The user that you want to ban. (you can provide a user ID)")
      .setRequired(true),
  )
  .addStringOption(string => string.setName("reason").setDescription("The reason for the ban."))
  .addStringOption(string =>
    string.setName("duration").setDescription("The duration of the ban (e.g 2mo, 1y)."),
  )
  .addStringOption(string =>
    string.setName("del").setDescription("Time of messages to delete (e.g 6h, 30m, max - 7d)."),
  )
  .addBooleanOption(bool =>
    bool
      .setName("silent")
      .setDescription(
        "If true, the user won’t be notified about this action (overrides the server setting).",
      ),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  if (!guild || !interaction.member) return;

  const user = interaction.options.getUser("user");
  if (!user)
    return await errorEmbed({
      interaction,
      title: "No user provided.",
      reason:
        "You somehow ran the command without a user being provided. That is an error. You might want to report this, as it is not supposed to ever happen.",
    });

  const isUserOrMember = (await safeMembers(guild)).has(user.id);
  const duration = interaction.options.getString("duration");
  const reason = interaction.options.getString("reason");
  const del = interaction.options.getString("del");
  if (
    await errorCheck("Ban Members", {
      interaction,
      user,
      action: "Ban",
      errorOptions: {
        allErrors: isUserOrMember,
        banCheckError: true,
        botError: true,
      },
    })
  )
    return;

  let delSec;
  let durationMs = null;

  if (duration) {
    durationMs = ms(duration);
    if (!durationMs || durationMs <= 0)
      return await errorEmbed({
        interaction,
        title: `You can’t ban ${user.username} temporarily.`,
        reason: "The duration is invalid.",
      });
  }

  const isSilent =
    interaction.options.getBoolean("silent") ??
    (await getSetting(guild.id, "moderation", "silent"));

  if (del) {
    // this has to be in seconds, thanks to whoever made the change
    delSec = (ms(del) ?? 0) / 1000;
    if (!delSec || delSec <= 0)
      return await errorEmbed({
        interaction,
        title: `The bot can’t remove messages of ${user.username} while banning.`,
        reason: "The duration is invalid.",
      });

    if (delSec > 604_800)
      return await errorEmbed({
        interaction,
        title: `The bot can’t remove messages of ${user.username} while banning.`,
        reason: "The duration is longer than 7 days.",
      });
  }

  try {
    const caseId = await modEmbed(
      {
        interaction,
        user,
        action: "Banned",
        duration: durationMs ?? undefined,
        shouldDm: isUserOrMember,
        dbAction: "BAN",
        expiresAt: durationMs ? new Date(durationMs) : undefined,
        isSilent,
      },
      reason,
    );
    if (duration && durationMs)
      await scheduleUnban(
        interaction.client,
        guild,
        user.id,
        durationMs,
        typeof caseId == "number" ? caseId : undefined,
      );

    await guild.members.ban(user.id, {
      reason: reason ?? undefined,
      deleteMessageSeconds: delSec ?? undefined,
    });
  } catch (error) {
    return await errorEmbed({ interaction, error, forward: true, fileName: "ban" });
  }
}
