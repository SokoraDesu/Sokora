import { getGuildLeaderboard } from "database/leveling";
import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
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

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  const guildID = guild?.id;
  if (!guildID)
    return await errorEmbed({ interaction, title: "This command can only be used in a server." });

  const leaderboardData = await getGuildLeaderboard(guildID);
  if (leaderboardData.length === 0)
    return await errorEmbed({
      interaction,
      title: "No data found.",
      reason: "There is no leveling data for this server yet.",
    });

  leaderboardData.sort((a, b) => {
    return b.level == a.level ? b.xp - a.xp : b.level - a.level;
  });

  const usersPerPage = 6;
  const pages = Math.ceil(leaderboardData.length / usersPerPage);
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);

  const generateEmbed = async (): Promise<EmbedBuilder> => {
    const start = page * usersPerPage;
    const pageData = leaderboardData.slice(start, start + usersPerPage);
    const embed = new EmbedBuilder()
      .setAuthor({ name: "Leaderboard" })
      .setColor(await colorize({ hue: Sokolors.Blue }));

    for (const [index, userData] of pageData.entries())
      embed.addFields({
        name: `#${start + index + 1} • ${(await safeUser(interaction.client, userData.userID)).tag}`,
        value: `Level **${Math.floor(userData.level)}** • **${Math.floor(userData.xp)}** XP`,
      });

    return embed;
  };

  const reply = await interaction.reply({
    embeds: [await generateEmbed()],
    components: pages > 1 ? [pagedButtons(pages, page)] : [],
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: 60_000 });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    page = await handlePages({ i: buttonInteraction, page, pages, collector });

    await safeReply({
      interaction: buttonInteraction,
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
