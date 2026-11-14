import {
  AttachmentBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { graph } from "features/math/graph";
import { colorize, Sokolors } from "utils/colorize";

export const data = new SlashCommandSubcommandBuilder()
  .setName("graph")
  .setDescription("Graph a mathematical function.")
  .addStringOption(option => {
    return option
      .setName("function")
      .setDescription("The function to graph (e.g., ’x^2’ or ’sin(x)’)")
      .setRequired(true);
  })
  .addNumberOption(option => option.setName("xmin").setDescription("Minimum x value"))
  .addNumberOption(option => option.setName("xmax").setDescription("Maximum x value"))
  .addNumberOption(option => option.setName("ymin").setDescription("Minimum y value"))
  .addNumberOption(option => option.setName("ymax").setDescription("Maximum y value"));

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const function_ = interaction.options.getString("function", true);
  const xmin = interaction.options.getNumber("xmin") ?? -10;
  const xmax = interaction.options.getNumber("xmax") ?? 10;
  const ymin = interaction.options.getNumber("ymin") ?? -10;
  const ymax = interaction.options.getNumber("ymax") ?? 10;

  const result = await graph({
    function: function_,
    xmin,
    xmax,
    ymin,
    ymax,
  });

  if (!result.success)
    return await errorEmbed(false, {
      interaction,
      ...result.out,
    });

  const attachment = new AttachmentBuilder(result.out, {
    name: "graph.png",
  });
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Function graph"),
      new TextDisplayBuilder().setContent(`\`f(x) = ${function_}\``),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL("attachment://graph.png"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  await interaction.reply({
    components: [container],
    files: [attachment],
    flags: "IsComponentsV2",
  });
}
