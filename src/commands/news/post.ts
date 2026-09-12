import { getLatestNews } from "database/news";
import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dekominator } from "utils/kominator";
import { newsModal } from "utils/newsModal";
import { replaceVariables } from "utils/replace";
import { safeMember } from "utils/safeThings";
import { sendChannelNews } from "utils/sendChannelNews";
import { isInteractionSafe } from "utils/types";

export const data = new SlashCommandSubcommandBuilder()
  .setName("post")
  .setDescription("Post your news.");

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

  const guild = interaction.guild;
  try {
    await interaction.showModal(await newsModal(null, guild));
  } catch (error) {
    await errorEmbed({ interaction, error, log: true, forward: true, fileName: "post" });
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

    try {
      const media = modalInteraction.fields.getUploadedFiles("images");
      await sendChannelNews(guild, interaction, {
        title,
        body,
        author: modalInteraction.user.displayName,
        imageURL: media
          ? dekominator(
              media
                .filter(
                  item =>
                    item.contentType &&
                    (item.contentType.startsWith("image/") ||
                      item.contentType.startsWith("video/")),
                )
                .map(image => image.url)
                .toReversed(),
            )
          : null,
        id: ((await getLatestNews(guild.id))[0]?.id ?? 0) + 1,
        category_id:
          (await getSetting(guild.id, "news", "categories")).length > 0
            ? modalInteraction.fields.getStringSelectValues("category")[0]
            : null,
      });
    } catch (error) {
      return await errorEmbed({ interaction, error, forward: true, fileName: "post" });
    }

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
