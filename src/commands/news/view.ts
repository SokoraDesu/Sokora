import { listAllNews } from "database/news";
import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { handlePages, pagedButtons } from "utils/pagination";
import { safeReply } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("view")
  .setDescription("View the news of this server.")
  .addNumberOption(number =>
    number.setName("page").setDescription("The news post that you want to see."),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  if (!interaction.guild)
    return await errorEmbed({
      interaction,
      title: "Error viewing a news post.",
      reason: "This command can only be used in a server.",
    });

  const news = await listAllNews(interaction.guild.id);
  const pages = news.length;
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);

  if (!news?.length)
    return await errorEmbed({
      interaction,
      title: "No news found.",
      reason: "Admins can post news with the **/news post** command.",
    });

  async function getEmbed(): Promise<EmbedBuilder> {
    const currentNews = news[page];
    const avatar = currentNews.authorPFP;
    return new EmbedBuilder()
      .setAuthor({
        name: `${dotCheck({ string: avatar, doubleSpace: true })}${currentNews.author}`,
        iconURL: avatar,
      })
      .setTitle(currentNews.title)
      .setDescription(currentNews.body)
      .setImage(currentNews.imageURL ?? null)
      .setTimestamp(currentNews.updatedAt ?? currentNews.createdAt)
      .setFooter({ text: `ID: ${currentNews.id}` })
      .setColor(await colorize({ hue: Sokolors.Blue }));
  }

  const reply = await interaction.reply({
    embeds: [await getEmbed()],
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
      editOptions: { embeds: [await getEmbed()], components: [pagedButtons(pages, page)] },
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
