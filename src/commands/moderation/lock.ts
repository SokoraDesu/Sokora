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
  .setName("lock")
  .setDescription("Locks a channel.")
  .addStringOption(string =>
    string.setName("reason").setDescription("The reason for locking the channnel."),
  )
  .addChannelOption(channel =>
    channel
      .setName("channel")
      .setDescription("The channel that you want to lock.")
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
      title: "You have provided a channel that can't be locked.",
    });

  if (!channel.permissionsFor(guild.id)?.has("SendMessages"))
    return await errorEmbed({
      interaction,
      title: "You can't execute this command.",
      reason: "The channel is already locked.",
    });

  try {
    await Promise.all([
      channel.permissionOverwrites.create(guild.id, {
        SendMessages: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
      }),
      modEmbed(
        {
          interaction,
          channel: channel.id,
          customText: { logTitle: "Locked a channel" },
        },
        reason,
      ),
    ]);
  } catch (error) {
    return await errorEmbed({
      interaction,
      error,
      forward: true,
      fileName: "lock.ts",
    });
  }
}
