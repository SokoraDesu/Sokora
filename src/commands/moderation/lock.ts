import {
  ChannelType,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { buildModEmbed } from "embeds/modEmbed";
import { lock } from "features/mod/lock";
import { assertInteraction } from "types";
import { safeChannel } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("lock")
  .setDescription("Locks a channel.")
  .addStringOption(string =>
    string.setName("reason").setDescription("The reason for locking the channnel."),
  )
  .addChannelOption(channel => {
    return channel
      .setName("channel")
      .setDescription("The channel that you want to lock.")
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      );
  });

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const channelOption = interaction.options.getChannel("channel");
  const reason = interaction.options.getString("reason");
  let channel = await safeChannel(interaction.guild, interaction.channel.id);
  if (channelOption) channel = await safeChannel(interaction.guild, channelOption.id);

  const result = await lock({
    channel,
    reason,
    moderator: interaction.user,
    guild: interaction.guild,
  });

  if (result.success)
    await interaction.reply({
      flags: ["IsComponentsV2", "Ephemeral"],
      components: [await buildModEmbed(result.out)],
    });
  else {
    await errorEmbed(false, { interaction, ...result.out });
  }
  return;
}
