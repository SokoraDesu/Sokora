import { listAllNews, listAllNewsInCategory } from "database/news";
import {
  SlashCommandSubcommandBuilder,
  type StringSelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ContainerBuilder,
  type Guild,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { newsEmbed } from "embeds/newsEmbed";
import { COLLECTOR_DURATION } from "utils/constants";
import { handlePages } from "utils/pagination";
import { safeEdit } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("view")
  .setDescription("View the news of this server.")
  .addNumberOption(number =>
    number.setName("page").setDescription("The news post that you want to see."),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  if (!guild)
    return await errorEmbed({
      interaction,
      title: "Error viewing a news post.",
      reason: "This command can only be used in a server.",
    });

  let news = await listAllNews(guild.id);
  let pages = news.length;
  if (!pages)
    return await errorEmbed({
      interaction,
      title: "No news found.",
      reason: "Admins can post news with the **/news post** command.",
    });

  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);

  async function getContainer(guild: Guild, isDisabled: boolean): Promise<ContainerBuilder> {
    const currentNews = news[page];
    const { author, title, body, id, imageURL } = currentNews;

    return await newsEmbed(guild, { title, body, author, id, imageURL }, false, {
      pages,
      page,
      isDisabled,
      willShowCategories: true,
    });
  }

  const reply = await interaction.reply({
    components: [await getContainer(guild, false)],
    flags: "IsComponentsV2",
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on(
    "collect",
    async (buttonInteraction: ButtonInteraction | StringSelectMenuInteraction) => {
      if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
      collector.resetTimer({ time: COLLECTOR_DURATION });
      const cID = buttonInteraction.customId;
      if (cID == "please") return;
      if (cID == "category") {
        const selectInteraction = buttonInteraction as StringSelectMenuInteraction;
        const value = selectInteraction.values[0];
        news =
          value && value == "all"
            ? await listAllNews(guild.id)
            : await listAllNewsInCategory(guild.id, value);

        pages = news.length;
      }

      page = await handlePages({
        i: buttonInteraction as ButtonInteraction,
        page,
        pages,
        collector,
      });
      await safeEdit({
        interaction: buttonInteraction,
        editOptions: { components: [await getContainer(guild, false)] },
      });
    },
  );

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [await getContainer(guild, true)] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
