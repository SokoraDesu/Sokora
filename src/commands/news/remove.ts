import { deleteNews, getNews } from "database/news";
import { getSetting } from "database/settings";
import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type TextChannel,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { safeChannel, safeMember } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("remove")
  .setDescription("Removes a news post.")
  .addNumberOption(number =>
    number
      .setName("id")
      .setDescription("The ID of the news post. (found in the footer)")
      .setRequired(true),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  if (!guild || !(await safeMember(guild, interaction.user.id)).permissions.has("ManageGuild"))
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

  const newsChannel = (await safeChannel(
    guild,
    ((await getSetting(guild.id, "news", "channel")) as string) ?? interaction.channel?.id,
  )) as TextChannel;

  if (newsChannel && news.messageID) await newsChannel.messages.delete(news.messageID);
  await deleteNews(guild.id, id);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("News post removed.")
        .setColor(await colorize({ hue: Sokolors.Green })),
    ],
    flags: "Ephemeral",
  });
}
