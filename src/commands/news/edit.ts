import { getNews } from "database/news";
import {
  ChannelType,
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { newsModal } from "utils/newsModal";
import { safeMember } from "utils/safeThings";
import { assertInteraction } from "types";
import { errorEmbed } from "embeds/errorEmbed";
import { edit } from "features/news/edit";

export const data = new SlashCommandSubcommandBuilder()
  .setName("edit")
  .setDescription("Edits a news post.")
  .addNumberOption(number => {
    return number
      .setName("id")
      .setDescription("The ID of the news post that you want to edit.")
      .setRequired(true);
  });

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const id = interaction.options.getNumber("id", true);
  const user = await safeMember(interaction.guild, interaction.user.id);
  const guild = interaction.guild;
  // TODO: duplicate within the feature?
  const news = await getNews(guild.id, id);
  if (!news) {
    return await errorEmbed(false, { title: "The specified news post doesn’t exist." });
  }

  try {
    await interaction.showModal(await newsModal(news));
  } catch (error) {
    return await errorEmbed(true, { interaction, error, fileName: "edit" });
  }

  interaction.client.once("interactionCreate", async modalInteraction => {
    if (
      !modalInteraction.isModalSubmit() ||
      !interaction.channel.isTextBased() ||
      interaction.channel.isVoiceBased() ||
      interaction.channel.isDMBased() ||
      interaction.channel.isThread() ||
      interaction.channel.type == ChannelType.GuildAnnouncement
    )
      return;

    const rawTitle = modalInteraction.fields.getTextInputValue("title");
    const rawBody = modalInteraction.fields.getTextInputValue("body");

    const result = await edit({
      userMember: user,
      rawBody,
      rawTitle,
      guild,
      id,
      fallbackChannel: interaction.channel,
    });

    if (!result.success) {
      return await errorEmbed(false, { interaction, ...result.out });
    }

    const editedContainer = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## News post edited."))
      .setAccentColor(await colorize({ hue: Sokolors.Green }));

    await modalInteraction.reply({
      components: [editedContainer],
      flags: ["Ephemeral", "IsComponentsV2"],
    });
  });
}
