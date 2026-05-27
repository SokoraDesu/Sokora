import {
  ChannelType,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { errorCheck, modEmbed } from "embeds/modEmbed";
import ms from "enhanced-ms";
import { safeChannel } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("slowdown")
  .setDescription("Slows a channel down.")
  .addStringOption(string =>
    string
      .setName("time")
      .setDescription(
        "Time to slow the channel down to (e.g 30m, 2h, max - 6h). 0 for no slowdown.",
      )
      .setRequired(true),
  )
  .addStringOption(string =>
    string.setName("reason").setDescription("The reason for the slowdown."),
  )
  .addChannelOption(channel =>
    channel
      .setName("channel")
      .setDescription("The channel that you want to slowdown.")
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
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
  let channel = await safeChannel(guild, interaction.channel.id);
  if (channelOption) channel = await safeChannel(guild, channelOption.id);

  if (
    await errorCheck("Manage Channels", {
      interaction,
      channel: channel.id,
      errorOptions: { allErrors: false, botError: true, channelError: true },
    })
  )
    return;

  const time = interaction.options.getString("time");
  if (!time)
    return await errorEmbed({
      interaction,
      title: "No time provided.",
      reason:
        "You somehow ran the command without a time value being provided. That is an error. You might want to report this, as it is not supposed to ever happen.",
    });
  const timeMs = ms(time);
  const reason = interaction.options.getString("reason");
  let title = `Set the slowdown to ${ms(ms(time), "fullPrecision")}`;

  if (!timeMs) title = "Removed the slowdown";
  if (timeMs > 21_600_000)
    return await errorEmbed({
      interaction,
      title: "You have provided a duration longer than 6 hours.",
    });

  if (!channel.isTextBased() || channel.isDMBased())
    return await errorEmbed({
      interaction,
      title: "You have provided a channel that can't be slowed down.",
    });

  await Promise.all([
    channel.setRateLimitPerUser(timeMs / 1000, reason ?? undefined),
    modEmbed(
      {
        interaction,
        channel: channel.id,
        customText: { logTitle: title },
      },
      reason,
    ),
  ]);
}
