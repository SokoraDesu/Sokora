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
import { post } from "features/news/post";

export const data = new SlashCommandSubcommandBuilder()
  .setName("post")
  .setDescription("Post your news.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const guild = interaction.guild;
  try {
    await interaction.showModal(await newsModal(null, guild));
  } catch (error) {
    return await errorEmbed(true, { interaction, error, fileName: "post" });
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
    const media = modalInteraction.fields.getUploadedFiles("images");
    const category = modalInteraction.fields.getStringSelectValues("category")[0];

    const result = await post({
      rawTitle,
      rawBody,
      fallbackChannel: interaction.channel,
      media,
      userMember: await safeMember(interaction.guild, interaction.user.id),
      guild,
      category,
    });

    if (!result.success)
      return errorEmbed(result.reason === "exception", { interaction, ...result.out });

    await modalInteraction.reply({
      components: [
        new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## News post created."))
          .setAccentColor(await colorize({ hue: Sokolors.Green })),
      ],
      flags: ["Ephemeral", "IsComponentsV2"],
    });
  });
}
