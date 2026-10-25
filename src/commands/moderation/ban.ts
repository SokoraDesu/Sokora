import { SlashCommandSubcommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { buildModEmbed } from "embeds/modEmbed";
import ms from "enhanced-ms";
import { ban } from "features/mod/ban";
import { assertInteraction } from "types";
import { SECONDS_7D } from "utils/constants";
import { shouldModerateSilently } from "utils/silent";

export const data = new SlashCommandSubcommandBuilder()
  .setName("ban")
  .setDescription("Bans a user.")
  .addUserOption(user => {
    return user
      .setName("user")
      .setDescription("The user that you want to ban. (you can provide a user ID)")
      .setRequired(true);
  })
  .addStringOption(string => string.setName("reason").setDescription("The reason for the ban."))
  .addStringOption(string =>
    string.setName("duration").setDescription("The duration of the ban (e.g 2mo, 1y)."),
  )
  .addStringOption(string =>
    string.setName("del").setDescription("Time of messages to delete (e.g 6h, 30m, max - 7d)."),
  )
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
  const duration = interaction.options.getString("duration");
  const reason = interaction.options.getString("reason");
  const del = interaction.options.getString("del");

  let durationMillisec: number | undefined;
  let delMessageSeconds: number | undefined;

  if (duration) {
    durationMillisec = ms(duration) ?? undefined;
    if (!durationMillisec || durationMillisec <= 0)
      return await errorEmbed(false, {
        interaction,
        title: `You can’t ban ${target.username} temporarily.`,
        reason: "The duration is invalid.",
      });
  }

  if (del) {
    // this has to be in seconds, thanks to whoever made the change
    delMessageSeconds = (ms(del) ?? 0) / 1000;
    if (!delMessageSeconds || delMessageSeconds <= 0)
      return await errorEmbed(false, {
        interaction,
        title: `The bot can’t remove messages of ${target.username} while banning.`,
        reason: "The duration is invalid.",
      });

    if (delMessageSeconds > SECONDS_7D)
      return await errorEmbed(false, {
        interaction,
        title: `The bot can’t remove messages of ${target.username} while banning.`,
        reason: "The duration is longer than 7 days.",
      });
  }

  const isSilent = await shouldModerateSilently(interaction);

  const result = await ban({
    delMessageSeconds,
    target,
    reason,
    guild: interaction.guild,
    moderator: interaction.user,
    durationMillisec,
    isSilent,
  });

  if (result.success)
    await interaction.reply({
      flags: isSilent ? ["IsComponentsV2", "Ephemeral"] : "IsComponentsV2",
      components: [await buildModEmbed(result.out)],
    });
  else {
    await errorEmbed(false, { interaction, ...result.out });
  }
  return;
}
