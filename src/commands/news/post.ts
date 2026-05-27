import { getLatestNews } from "database/news";
import {
  EmbedBuilder,
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  SlashCommandSubcommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { modalSubmit } from "utils/modalSubmit";
import { replaceVariables } from "utils/replace";
import { safeMember } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";

export const data = new SlashCommandSubcommandBuilder()
  .setName("post")
  .setDescription("Post your news.");

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  const userID = interaction.user.id;
  if (!guild || !(await safeMember(guild, userID)).permissions.has("ManageGuild"))
    return await errorEmbed({
      interaction,
      title: "You can't execute this command.",
      reason: "You need the **Manage Server** permission.",
    });

  const newsModal = new ModalBuilder()
    .setCustomId("postnews")
    .setTitle("•  Write your news post.")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Title")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("title")
            .setPlaceholder("Think of a title")
            .setMaxLength(30)
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Content (supports Markdown)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("body")
            .setPlaceholder("Write your news post here")
            .setMaxLength(4000)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Upload a banner image if you want")
        .setFileUploadComponent(
          new FileUploadBuilder().setCustomId("image").setMinValues(0).setRequired(false),
        ),
    );

  try {
    await interaction.showModal(newsModal);
  } catch (error) {
    await errorEmbed({ interaction, error, forward: true, fileName: "post.ts" });
  }

  const modalInteraction = await modalSubmit(interaction);
  if (!modalInteraction) return;

  const title = await replaceVariables(
    modalInteraction.fields.getTextInputValue("title"),
    interaction.guild,
    interaction.user,
  );

  const body = await replaceVariables(
    modalInteraction.fields.getTextInputValue("body"),
    interaction.guild,
    interaction.user,
  );

  try {
    await sendChannelNews(guild, interaction, {
      title,
      body,
      author: modalInteraction.user.displayName,
      authorPFP: modalInteraction.user.avatarURL() ?? undefined,
      imageURL: modalInteraction.fields.getUploadedFiles("image")?.at(0)?.url ?? null,
      id: ((await getLatestNews(guild.id))[0]?.id ?? 0) + 1,
    });
  } catch (error) {
    return await errorEmbed({ interaction, error, forward: true, fileName: "post.ts" });
  }

  await modalInteraction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("News post created.")
        .setColor(await colorize({ hue: Sokolors.Green })),
    ],
    flags: "Ephemeral",
  });
}
