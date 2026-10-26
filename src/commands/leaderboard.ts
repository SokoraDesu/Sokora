import { getGuildLeaderboard } from "database/leveling";
import {
  ContainerBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { isButtonErrory } from "utils/buttonCheck";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION } from "utils/constants";
import { handlePages, pagedButtons } from "utils/pagination";
import { safeEdit, safeUser } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Displays the guild leaderboard.")
  .addNumberOption(option => option.setName("page").setDescription("Page number to display."))
  .setContexts(InteractionContextType.Guild);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  const guildID = guild?.id;
  if (!guildID)
    return await errorEmbed(false, {
      interaction,
      title: "This command can only be used in a server.",
    });

  const leaderboardData = await getGuildLeaderboard(guildID);
  if (leaderboardData.length === 0)
    return await errorEmbed(false, {
      interaction,
      title: "No data found.",
      reason: "There is no leveling data for this server yet.",
    });

  leaderboardData.sort((a, b) => (b.level == a.level ? b.xp - a.xp : b.level - a.level));

  const usersPerPage = 10;
  const pages = Math.ceil(leaderboardData.length / usersPerPage);
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);

  const generateContainer = async (isDisabled: boolean): Promise<ContainerBuilder> => {
    const start = page * usersPerPage;
    const pageData = leaderboardData.slice(start, start + usersPerPage);
    const content = [];
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Leaderboard"))
      .setAccentColor(await colorize({ hue: Sokolors.Blue }));

    for (const [index, userData] of pageData.entries())
      content.push(
        `**#${start + index + 1}** • ${(await safeUser(interaction.client, userData.user_id)).tag} • Level **${Math.floor(userData.level)}** @ **${Math.floor(userData.xp)}** XP`,
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
    if (await isButtonErrory({ i: buttonInteraction, interaction, reply })) return;
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
