import { listAllNews } from "database/news";
import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { pagedButtons } from "utils/pagination";

export const data = new SlashCommandSubcommandBuilder()
  .setName("view")
  .setDescription("View the news of this server.")
  .addNumberOption(number =>
    number.setName("page").setDescription("The news post that you want to see."),
  );

export async function run(interaction: ChatInputCommandInteraction) {
  let page = interaction.options.getNumber("page") ?? 1;
  if (!interaction.guild)
    return await errorEmbed({
      interaction,
      title: "Error viewing a news post.",
      reason: "This command can only be used in a server.",
    });

  const news = await listAllNews(interaction.guild.id);
  const pages = news.length;

  if (!news || !pages)
    return await errorEmbed({
      interaction,
      title: "No news found.",
      reason: "Admins can post news with the **/news post** command.",
    });

  if (page > pages) page = pages;
  if (page < 1) page = 1;

  async function getEmbed() {
    const currentNews = news[page - 1];
    const avatar = currentNews.authorPFP;
    return new EmbedBuilder()
      .setAuthor({
        name: `${dotCheck({ string: avatar, doubleSpace: true })}${currentNews.author}`,
        iconURL: avatar,
      })
      .setTitle(currentNews.title)
      .setDescription(currentNews.body)
      .setImage(currentNews.imageURL || null)
      .setTimestamp(currentNews.updatedAt || currentNews.createdAt)
      .setFooter({
        text: `${pages > 1 ? `Page ${page} of ${pages} • ` : ""}ID: ${currentNews.id}`,
      })
      .setColor(await colorize({ hue: Sokolors.Blue }));
  }

  const row = pagedButtons(pages, page);
  const reply = await interaction.reply({
    embeds: [await getEmbed()],
    components: pages > 1 ? [row] : [],
  });

  if (page < 1) return;
  const collector = reply.createMessageComponentCollector({ time: 60000 });
  collector.on("collect", async (i: ButtonInteraction) => {
    if (await buttonCheck({ i, interaction, reply })) return;
    collector.resetTimer({ time: 60000 });
    switch (i.customId) {
      case "left":
        page--;
        if (page < 1) page = pages;
        await i.update({ embeds: [await getEmbed()], components: [row] });
        break;
      case "right":
        page++;
        if (page > pages) page = 1;
        await i.update({ embeds: [await getEmbed()], components: [row] });
        break;
    }
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
