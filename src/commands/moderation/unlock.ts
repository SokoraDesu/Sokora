import {
  ChannelType,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { errorCheck, modEmbed } from "embeds/modEmbed";
import { safeChannel } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("unlock")
  .setDescription("Unlocks a channel.")
  .addStringOption(string =>
    string.setName("reason").setDescription("The reason for unlocking the chanel."),
  )
  .addChannelOption(channel =>
    channel
      .setName("channel")
      .setDescription("The channel that you want to unlock.")
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ),
  );

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  const guild = interaction.guild;
  if (!guild || !interaction.channel) return;
  const channelOption = interaction.options.getChannel("channel");
  const reason = interaction.options.getString("reason");
  let channel = await safeChannel(guild, interaction.channel.id);
  if (channelOption) channel = await safeChannel(guild, channelOption.id);

  if (
    await errorCheck("Manage Roles", {
      interaction,
      channel: channel.id,
      errorOptions: { allErrors: false, botError: true, channelError: true },
    })
  )
    return;

  if (channel.isThread() || channel.isDMBased())
    return await errorEmbed({
      interaction,
      title: "You have provided a channel that can't be locked in the first place.",
    });

  if (channel.permissionsFor(guild.id)?.has("SendMessages"))
    return await errorEmbed({
      interaction,
      title: "You can't execute this command.",
      reason: "The channel is not locked.",
    });

  try {
    await Promise.all([
      channel.permissionOverwrites.create(guild.id, {
        SendMessages: null,
        SendMessagesInThreads: null,
        CreatePublicThreads: null,
        CreatePrivateThreads: null,
      }),
      modEmbed(
        {
          interaction,
          channel: channel.id,
          customText: { logTitle: "Unlocked a channel" },
        },
        reason,
      ),
    ]);
  } catch (error) {
    await errorEmbed({ interaction, error, forward: true, fileName: "unlock.ts" });
  }
}
