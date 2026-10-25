import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { modEmbed } from "embeds/modEmbed";
import ms from "enhanced-ms";
import { mute } from "features/mod/mute";
import { assertInteraction } from "types";
import { shouldModerateSilently } from "utils/silent";

export const data = new SlashCommandSubcommandBuilder()
  .setName("mute")
  .setDescription("Mutes a user.")
  .addUserOption(user =>
    user.setName("user").setDescription("The user that you want to mute.").setRequired(true),
  )
  .addStringOption(string => {
    return string
      .setName("duration")
      .setDescription("The duration of the mute (e.g 30m, 1d, 2h).")
      .setRequired(true);
  })
  .addStringOption(string => string.setName("reason").setDescription("The reason for the mute."))
  .addBooleanOption(bool => {
    return bool
      .setName("silent")
      .setDescription(
        "If true, the user won’t be notified about this action (overrides the server setting).",
      );
  });

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const target = interaction.options.getUser("user", true);
  const duration = interaction.options.getString("duration", true);
  const reason = interaction.options.getString("reason");

  const durationMillisec = ms(duration);

  if (!durationMillisec) {
    return await errorEmbed(false, {
      interaction,
      title: `You can’t mute ${target.username}.`,
      reason: "The duration is invalid.",
    });
  }

  const isSilent = await shouldModerateSilently(interaction);

  const result = await mute({
    target,
    durationMillisec,
    reason,
    moderator: interaction.user,
    guild: interaction.guild,
    isSilent,
  });

  return result.success
    ? await modEmbed({ ...result.out, interaction })
    : await errorEmbed(result.reason === "exception", { interaction, ...result.out });
}
