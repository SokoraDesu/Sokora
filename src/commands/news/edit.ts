import { getNews, updateNews } from "database/news";
import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type TextChannel,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { newsEmbed } from "embeds/newsEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { newsModal } from "utils/newsModal";
import { replaceVariables } from "utils/replace";
import { safeChannel, safeMember } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";
import { isInteractionSafe } from "utils/types";

export const data = new SlashCommandSubcommandBuilder()
  .setName("edit")
  .setDescription("Edits a news post.")
  .addNumberOption(number =>
    number
      .setName("id")
      .setDescription("The ID of the news post that you want to edit.")
      .setRequired(true),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const user = interaction.user;
  if (
    !isInteractionSafe(interaction) ||
    !(await safeMember(interaction.guild, user.id)).permissions.has("ManageGuild")
  )
    return await errorEmbed({
      interaction,
      title: "You can’t execute this command.",
      reason: "You need the **Manage Server** permission.",
    });

  const id = interaction.options.getNumber("id");
  if (!id)
    return await errorEmbed({
      interaction,
      title: "No ID provided.",
      reason:
        "You somehow ran the command without an ID being provided. That is an error. You might want to report this, as it is not supposed to ever happen.",
    });

  const guild = interaction.guild;
  const news = await getNews(guild.id, id);
  if (!news)
    return await errorEmbed({ interaction, title: "The specified news post doesn’t exist." });

  try {
    await interaction.showModal(await newsModal(news));
  } catch (error) {
    await errorEmbed({ interaction, error, log: true, forward: true, fileName: "edit" });
  }

  interaction.client.once("interactionCreate", async modalInteraction => {
    if (!modalInteraction.isModalSubmit()) return;

    const title = await replaceVariables(
      modalInteraction.fields.getTextInputValue("title"),
      guild,
      user,
    );

    const body = await replaceVariables(
      modalInteraction.fields.getTextInputValue("body"),
      guild,
      user,
    );

    const editedContainer = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## News post edited."))
      .setAccentColor(await colorize({ hue: Sokolors.Green }));

    if (!(await getSetting(interaction.guild.id, "news", "edit_original_message"))) {
      await sendChannelNews(
        interaction.guild,
        interaction,
        { title, body, author: news.author, id },
        true,
      );
      return await modalInteraction.reply({
        components: [editedContainer],
        flags: ["Ephemeral", "IsComponentsV2"],
      });
    }

    const channel = (await safeChannel(
      interaction.guild,
      (await getSetting(interaction.guild.id, "news", "channel")) ?? interaction.channel.id,
    )) as TextChannel;

    await Promise.all([
      channel.messages.edit(news.messageID, {
        components: [
          await newsEmbed(interaction.guild, { title, body, author: news.author, id }, true),
        ],
        flags: "IsComponentsV2",
      }),
      updateNews(interaction.guild.id, id, title, body),
      modalInteraction.reply({
        components: [editedContainer],
        flags: ["Ephemeral", "IsComponentsV2"],
      }),
    ]);
  });
}
