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
import { safeMember } from "utils/safeThings";
import { assertInteraction } from "types";
import { remove } from "features/news/remove";

export const data = new SlashCommandSubcommandBuilder()
  .setName("remove")
  .setDescription("Removes a news post.")
  .addNumberOption(number => {
    return number
      .setName("id")
      .setDescription("The ID of the news post. (found in the footer)")
      .setRequired(true);
  });

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  assertInteraction(interaction);
  const id = interaction.options.getNumber("id", true);

  if (
    // IDEA: maybe move to assertInteraction
    // and maybe split that into other fns + rename it as it's growing in scope
    !interaction.member ||
    !interaction.channel.isTextBased() ||
    interaction.channel.isVoiceBased() ||
    interaction.channel.isDMBased() ||
    interaction.channel.isThread()
  )
    return;

  const result = await remove({
    id,
    userMember: await safeMember(interaction.guild, interaction.user.id),
    guild: interaction.guild,
    fallbackChannel: interaction.channel,
  });

  if (!result.success)
    return errorEmbed(result.reason === "exception", { interaction, ...result.out });

  await interaction.reply({
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## News post removed."))
        .setAccentColor(await colorize({ hue: Sokolors.Green })),
    ],
    flags: ["Ephemeral", "IsComponentsV2"],
  });
}
