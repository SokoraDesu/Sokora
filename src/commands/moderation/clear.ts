import {
  ChannelType,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { modEmbed } from "embeds/modEmbed";
import { clear } from "features/mod/clear";
import { assertInteraction } from "types";
import { safeChannel } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("clear")
  .setDescription("Clears messages.")
  .addNumberOption(number => {
    return number
      .setName("amount")
      .setDescription("The amount of messages that you want to clear (maximum is 100).")
      .setRequired(true);
  })
  .addChannelOption(channel => {
    return channel
      .setName("channel")
      .setDescription("The channel that has the messages that you want to clear.")
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      );
  })
  .addUserOption(user =>
    user.setName("user").setDescription("Only clear messages from this specific user."),
  )
  .addUserOption(user =>
    user.setName("reason").setDescription("The reason for clearing the messages."),
  );

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const reason = interaction.options.getString("reason");
  const channelOption = interaction.options.getChannel("channel");
  let target = await safeChannel(interaction.guild, interaction.channel.id);
  if (channelOption) target = await safeChannel(interaction.guild, channelOption.id);
  const amount = interaction.options.getNumber("amount", true);

  const targetUser = interaction.options.getUser("user") ?? undefined;
  if (!target.isTextBased() || target.isDMBased())
    return await errorEmbed(false, {
      interaction,
      title: "You have provided a channel that can’t have messages to clear.",
    });

  const result = await clear({
    targetUser,
    amount,
    reason,
    target,
    moderator: interaction.user,
  });

  return result.success
    ? await modEmbed({ ...result.out, interaction })
    : await errorEmbed(result.reason === "exception", { interaction, ...result.out });
}
