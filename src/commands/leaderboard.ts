import { getGuildLeaderboard } from "database/leveling";
import {
  ContainerBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION } from "utils/constants";
import { handlePages, pagedButtons } from "utils/pagination";
import { safeEdit, safeUser } from "utils/safeThings";
import { getLevelingShow } from "database/settings";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Displays the guild leaderboard.")
  .addNumberOption(option => option.setName("page").setDescription("Page number to display."))
  .setContexts(0);

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  const guildID = guild?.id;
  if (!guildID)
    return await errorEmbed({ interaction, title: "This command can only be used in a server." });

  const leaderboardData = await getGuildLeaderboard(guildID);

  const visibility = await Promise.all(
    leaderboardData.map(async userData => getLevelingShow(userData.userID)),
  );

  const visibleLeaderboardData = leaderboardData.filter((_, index) => visibility[index]);

  if (visibleLeaderboardData.length === 0)
    return await errorEmbed({
      interaction,
      title: "No data found.",
      reason: "There is no visible leveling data for this server yet.",
    });

  visibleLeaderboardData.sort((a, b) => {
    return b.level == a.level ? b.xp - a.xp : b.level - a.level;
  });

  const usersPerPage = 10;
  const pages = Math.ceil(visibleLeaderboardData.length / usersPerPage);
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);

  const generateContainer = async (isDisabled: boolean): Promise<ContainerBuilder> => {
    const start = page * usersPerPage;
    const pageData = visibleLeaderboardData.slice(start, start + usersPerPage);
    const content = [];
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Leaderboard"))
      .setAccentColor(await colorize({ hue: Sokolors.Blue }));

    for (const [index, userData] of pageData.entries())
      content.push(
        `**#${start + index + 1}** • ${(await safeUser(interaction.client, userData.userID)).tag} • Level **${Math.floor(userData.level)}** @ **${Math.floor(userData.xp)}** XP`,
      );

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content.join("\n")));
    if (pages > 1) container.addActionRowComponents(pagedButtons(pages, page, isDisabled));
    return container;
  };

  const reply = await interaction.reply({
    components: [await generateContainer(false)],
    flags: "IsComponentsV2",
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: COLLECTOR_DURATION });
    if (buttonInteraction.customId == "please") return;

    page = await handlePages({ i: buttonInteraction, page, pages, collector });
    await safeEdit({
      interaction: buttonInteraction,
      editOptions: { components: [await generateContainer(false)] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [await generateContainer(true)] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
