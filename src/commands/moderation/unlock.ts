import {
  ChannelType,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { modEmbed } from "embeds/modEmbed";
import { unlock } from "features/mod/unlock";
import { assertInteraction } from "types";
import { safeChannel } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("unlock")
  .setDescription("Unlocks a channel.")
  .addStringOption(string =>
    string.setName("reason").setDescription("The reason for unlocking the chanel."),
  )
  .addChannelOption(channel => {
    return channel
      .setName("channel")
      .setDescription("The channel that you want to unlock.")
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

  const result = await unlock({
    channel,
    reason,
    guild: interaction.guild,
    moderator: interaction.user,
  });

  return result.success
    ? await modEmbed({ ...result.out, interaction })
    : await errorEmbed(result.reason === "exception", { interaction, ...result.out });
}
