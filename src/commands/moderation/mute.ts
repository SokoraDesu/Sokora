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
import { safeMember } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("mute")
  .setDescription("Mutes a user.")
  .addUserOption(user =>
    user.setName("user").setDescription("The user that you want to mute.").setRequired(true),
  )
  .addStringOption(string =>
    string
      .setName("duration")
      .setDescription("The duration of the mute (e.g 30m, 1d, 2h).")
      .setRequired(true),
  )
  .addStringOption(string => string.setName("reason").setDescription("The reason for the mute."))
  .addBooleanOption(bool =>
    bool
      .setName("silent")
      .setDescription(
        "If true, the user won't be notified about this action (overrides the server setting).",
      ),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<undefined | Message | InteractionResponse> {
  const guild = interaction.guild;
  if (!guild) return;

  const user = interaction.options.getUser("user");
  const duration = interaction.options.getString("duration");
  if (!user)
    return await errorEmbed({
      interaction,
      title: "No user provided.",
      reason:
        "You somehow ran the command without a user being provided. That is an error. You might want to report this, as it is not supposed to ever happen.",
    });

  const reason = interaction.options.getString("reason");

  if (
    await errorCheck("Moderate Members", {
      interaction,
      user,
      action: "Mute",
      errorOptions: { allErrors: true, botError: true, ownerError: true, outsideError: true },
    })
  )
    return;

  if (!duration || !ms(duration) || ms(duration) > ms("28d") || ms(duration) <= 0)
    return await errorEmbed({
      interaction,
      title: `You can't mute ${user.username}.`,
      reason: "The duration is invalid or is above the 28 day limit.",
    });

  if ((await safeMember(guild, user.id)).isCommunicationDisabled())
    return await errorEmbed({
      interaction,
      title: `You can't mute ${user.username}.`,
      reason: "The user is already muted.",
    });

  const time = new Date(
    Date.parse(new Date().toISOString()) + Date.parse(new Date(ms(duration)).toISOString()),
  ).toISOString();
  const silent =
    interaction.options.getBoolean("silent") ??
    ((await getSetting(guild.id, "moderation", "silent")) as boolean);

  try {
    await modEmbed(
      {
        interaction,
        user,
        action: "Muted",
        duration: ms(duration),
        dm: true,
        dbAction: "MUTE",
        expiresAt: new Date(ms(duration)),
        silent,
      },
      reason,
    );
    await (
      await safeMember(guild, user.id)
    )?.edit({ communicationDisabledUntil: time, reason: reason ?? undefined });
  } catch (error) {
    await errorEmbed({ interaction, error, forward: true, fileName: "mute.ts" });
  }
}
