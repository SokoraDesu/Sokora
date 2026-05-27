import {
  ChannelType,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type User,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { errorCheck, modEmbed } from "embeds/modEmbed";
import { pluralOrNot } from "utils/pluralOrNot";
import { safeChannel } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("clear")
  .setDescription("Clears messages.")
  .addNumberOption(number =>
    number
      .setName("amount")
      .setDescription("The amount of messages that you want to clear (maximum is 100).")
      .setRequired(true),
  )
  .addChannelOption(channel =>
    channel
      .setName("channel")
      .setDescription("The channel that has the messages that you want to clear.")
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ),
  )
  .addUserOption(user =>
    user.setName("user").setDescription("Only clear messages from this specific user."),
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
    await errorCheck("Manage Messages", {
      interaction,
      channel: channel?.id,
      errorOptions: { allErrors: false, botError: true, channelError: true },
    })
  )
    return;

  const amount = interaction.options.getNumber("amount");
  if (!amount)
    return await errorEmbed({
      interaction,
      title: "No amount provided.",
      reason:
        "You somehow ran the command without an amount being provided. That is an error. You might want to report this, as it is not supposed to ever happen.",
    });

  if (amount > 100)
    return await errorEmbed({
      interaction,
      title: "You can only clear up to 100 messages at a time.",
    });

  if (amount < 1)
    return await errorEmbed({ interaction, title: "You must clear at least 1 message." });

  const targetUser = interaction.options.getUser("user");
  let deletedAmount = 0;
  if (!channel.isTextBased() || channel.isDMBased())
    return await errorEmbed({
      interaction,
      title: "You have provided a channel that can't have messages to clear.",
    });

  try {
    if (targetUser) {
      const userMessages = (await channel.messages.fetch({ limit: 100 }))
        .filter(m => m.author.id == targetUser.id && !m.partial)
        .first(amount);

      if (userMessages.length === 0)
        return await errorEmbed({
          interaction,
          title: "No messages found.",
          reason: "No messages from this user were found in the recent history.",
        });

      await channel.bulkDelete(userMessages, true);
      deletedAmount = userMessages.length;
    } else {
      await channel.bulkDelete(amount, true).then(messages => (deletedAmount = messages.size));

      if (deletedAmount == 0)
        return await errorEmbed({
          interaction,
          title: "No messages found.",
          reason: "No messages were found in the recent history.",
        });
    }
  } catch (error) {
    return await errorEmbed({
      interaction,
      error,
      forward: true,
      fileName: "clear.ts",
    });
  }

  await modEmbed({
    interaction,
    user: targetUser as User | undefined,
    channel: channel.id,
    customText: {
      logTitle: `Cleared ${deletedAmount} ${pluralOrNot("message", deletedAmount)}${targetUser ? ` from ${targetUser.username}` : ""}`,
    },
  });
}
