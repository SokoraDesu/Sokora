import { getNews, updateNews } from "database/news";
import { getSetting } from "database/settings";
import {
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  SlashCommandSubcommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type Role,
  type TextChannel,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { mention } from "utils/mention";
import { modalSubmit } from "utils/modalSubmit";
import { safeChannel, safeMember, safeRole } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";

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
  const guild = interaction.guild;
  const userID = interaction.user.id;
  if (!guild || !(await safeMember(guild, userID)).permissions.has("ManageGuild"))
    return await errorEmbed({
      interaction,
      title: "You can't execute this command.",
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
  const news = await getNews(guild.id, id);
  if (!news)
    return await errorEmbed({ interaction, title: "The specified news post doesn't exist." });

  const editModal = new ModalBuilder()
    .setCustomId("editnews")
    .setTitle(`•  Edit news post: ${news.title}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Title")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("title")
            .setMaxLength(30)
            .setStyle(TextInputStyle.Short)
            .setValue(news.title)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Content (supports Markdown)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("body")
            .setMaxLength(4000)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(news.body)
            .setRequired(true),
        ),
    );

  try {
    await interaction.showModal(editModal);
  } catch (error) {
    await errorEmbed({ interaction, error, forward: true, fileName: "edit.ts" });
  }

  const modalInteraction = await modalSubmit(interaction);
  if (!modalInteraction) return;

  const role = (await getSetting(guild.id, "news", "role")) as string;
  const roleToSend: Role | null = role ? await safeRole(guild, role) : null;

  const title = modalInteraction.fields.getTextInputValue("title");
  const body = modalInteraction.fields.getTextInputValue("body");
  const avatar = news.authorPFP;
  const editedEmbed = new EmbedBuilder()
    .setTitle("News post edited.")
    .setColor(await colorize({ hue: Sokolors.Green }));

  if (!(await getSetting(guild.id, "news", "edit_original_message"))) {
    await sendChannelNews(
      guild,
      interaction,
      {
        title,
        body,
        author: news.author,
        authorPFP: avatar,
        id,
      },
      true,
    );
    return await modalInteraction.reply({ embeds: [editedEmbed], flags: "Ephemeral" });
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${news.author}`,
      iconURL: avatar,
    })
    .setTitle(title)
    .setDescription(body)
    .setTimestamp(news.updatedAt ?? news.createdAt)
    .setFooter({ text: `Edited news post from ${guild.name} • ID: ${news.id}` })
    .setColor(await colorize({ hue: Sokolors.Blue }));

  const channel = (await safeChannel(
    guild,
    ((await getSetting(guild.id, "news", "channel")) as string) ?? interaction.channel?.id,
  )) as TextChannel;

  await channel.messages.edit(news.messageID, {
    embeds: [embed],
    content: roleToSend ? mention(roleToSend.id, "ROLE") : undefined,
  });

  await updateNews(guild.id, id, title, body);
  await modalInteraction.reply({ embeds: [editedEmbed], flags: "Ephemeral" });
}
