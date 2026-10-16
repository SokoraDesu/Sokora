import {
  getSetting,
  setSetting,
  settingsDefinition,
  userSettingsKeys,
  setLevelingShow,
  type TS,
} from "database/settings";
import {
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { settingsEmbed } from "embeds/settingsEmbed";
import { isInteractionSafe } from "utils/types";
import { safeReply } from "utils/safeThings";

export const data = new SlashCommandSubcommandGroupBuilder()
  .setName("settings")
  .setDescription("Configure Sokora to your liking.");

data.addSubcommand(
  new SlashCommandSubcommandBuilder()
    .setName("leveling")
    .setDescription("Configure your leaderboard visibility.")
    .addBooleanOption(option =>
      option
        .setName("show")
        .setDescription("Whether your name and XP appear on the leaderboard.")
        .setRequired(true),
    ),
);

for (const key of userSettingsKeys)
  data.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(key)
      .setDescription(settingsDefinition[key].description),
  );

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isInteractionSafe(interaction))
    throw new Error("Why is user null if you are setting a user-table setting?");

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "leveling") {
    const isShow = interaction.options.getBoolean("show", true);

    await setLevelingShow(interaction.user.id, isShow);

    await safeReply({
      interaction,
      replyOptions: {
        content: isShow
          ? "You will now appear on the leveling leaderboard."
          : "You will no longer appear on the leveling leaderboard.",
        flags: ["Ephemeral"],
      },
    });

    return;
  }

  const key = subcommand as keyof TS;
  await settingsEmbed(interaction, key, {
    setSettingPlease: async (key, setting, value) => {
      await setSetting(interaction.user.id, key, setting, value);
    },
    getSettingPlease: async (key, setting) => {
      const value = await getSetting(interaction.user.id, key, setting);
      return value;
    },
  });
}
