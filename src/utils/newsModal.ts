import type { getNews } from "database/news";
import { getSetting } from "database/settings";
import {
  FileUploadBuilder,
  type Guild,
  type GuildBasedChannel,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { MAX_INPUT_CHARS } from "./constants";
import { safeChannel } from "./safeThings";

/**
 * Sends a modal that lets you write/edit a news post.
 * @param newsPost Already existing news post. If provided, the modal will be editing said post.
 * @param guild The guild where the command is ran. If provided, the modal will show news categories.
 * @returns News modal.
 */
export async function newsModal(
  newsPost?: Awaited<ReturnType<typeof getNews>>,
  guild?: Guild,
): Promise<ModalBuilder> {
  const modal = new ModalBuilder()
    .setCustomId(newsPost ? "editnews" : "postnews")
    .setTitle(newsPost ? `•  Edit news post: ${newsPost.title}` : "•  Write your news post")
    .addLabelComponents(
      new LabelBuilder().setLabel("Title").setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("title")
          .setPlaceholder("Think of a title")
          .setMaxLength(100)
          .setStyle(TextInputStyle.Short)
          .setValue(newsPost ? newsPost.title : "")
          .setRequired(true),
      ),
      new LabelBuilder().setLabel("Content (supports Markdown)").setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("body")
          .setPlaceholder("Write your news post here")
          .setMaxLength(MAX_INPUT_CHARS)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(newsPost ? newsPost.body : "")
          .setRequired(true),
      ),
    );

  if (!newsPost) {
    if (guild) {
      const categories = await getSetting(guild.id, "news", "categories");
      if (categories.length > 0) {
        const options = await Promise.all(
          categories.map(async category => {
            return new StringSelectMenuOptionBuilder()
              .setLabel(category.name)
              .setDescription(
                `Sends to #${((await safeChannel(guild, category.channel ?? (await getSetting(guild.id, "news", "channel")))) as GuildBasedChannel).name}`,
              )
              .setValue(category.$);
          }),
        );

        modal.addLabelComponents(
          new LabelBuilder()
            .setLabel("What category does your post belong to?")
            .setStringSelectMenuComponent(
              new StringSelectMenuBuilder()
                .setCustomId("category")
                .setMaxValues(1)
                .setOptions(options)
                .setRequired(false),
            ),
        );
      }
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Upload some media to accompany your post")
        .setFileUploadComponent(
          new FileUploadBuilder().setCustomId("images").setMaxValues(10).setRequired(false),
        ),
    );
  }

  return modal;
}
