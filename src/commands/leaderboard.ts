import { getGuildLeaderboard } from "database/leveling";
import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { handlePages, pagedButtons } from "utils/pagination";
import { safeReply, safeUser } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Displays the guild leaderboard.")
  .addNumberOption(option => option.setName("page").setDescription("Page number to display."))
  .setContexts(0);

export async function run(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  const guildID = guild?.id;
  if (!guildID)
    return await errorEmbed({ interaction, title: "This command can only be used in a server." });

  const leaderboardData = await getGuildLeaderboard(guildID);
  if (!leaderboardData.length)
    return await errorEmbed({
      interaction,
      title: "No data found.",
      reason: "There is no leveling data for this server yet.",
    });

  leaderboardData.sort((a, b) => {
    if (b.level != a.level) return b.level - a.level;
    else return b.xp - a.xp;
  });

  const usersPerPage = 6;
  const pages = Math.ceil(leaderboardData.length / usersPerPage);
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") || 0, pages) - 1);

  const generateEmbed = async () => {
    const start = page * usersPerPage;
    const pageData = leaderboardData.slice(start, start + usersPerPage);
    const embed = new EmbedBuilder()
      .setAuthor({ name: "Leaderboard" })
      .setColor(await colorize({ hue: Sokolors.Blue }));

    for (let i = 0; i < pageData.length; i++) {
      const userData = pageData[i];
      embed.addFields({
        name: `#${start + i + 1} • ${(await safeUser(interaction.client, userData.userID)).tag}`,
        value: `Level **${Math.floor(userData.level)}** • **${Math.floor(userData.xp)}** XP`,
      });
    }

    return embed;
  };

  const reply = await interaction.reply({
    embeds: [await generateEmbed()],
    components: pages > 1 ? [pagedButtons(pages, page)] : [],
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: 60000 });
  collector.on("collect", async (i: ButtonInteraction) => {
    if (await buttonCheck({ i, interaction, reply })) return;
    collector.resetTimer({ time: 60000 });
    page = await handlePages({ i, page, pages, collector });

    await safeReply({
      interaction: i,
      editOptions: { embeds: [await generateEmbed()], components: [pagedButtons(pages, page)] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
