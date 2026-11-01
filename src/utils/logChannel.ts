import { getSetting } from "database/settings";
import type {
  Channel,
  DMChannel,
  Guild,
  InteractionResponse,
  Message,
  MessageCreateOptions,
  MessagePayload,
  TextChannel,
  User,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "./channelCheck";
import { safeChannel, safeMember } from "./safeThings";

/**
 * Sends a message in the log channel. (if there is one set)
 * @param guild - The guild where the log channel is located.
 * @param options - Reply options of the log.
 * @param dm - Whether or not should the bot send a DM to the user.
 * @param dmOptions - Options for sending a DM to the user.
 * @returns Log message.
 * TODO(v0.4): improve the shape of this a little, and review where i'm using this
 */
export async function logChannel(
  guild: Guild,
  options: string | MessagePayload | MessageCreateOptions,
  shouldDm?: boolean,
  dmOptions?: {
    isSilent: boolean;
    user: User;
    options: string | MessagePayload | MessageCreateOptions;
  },
  logType: "moderation" | "notifications" = "moderation",
): Promise<undefined | Message | InteractionResponse> {
  let channel: TextChannel | DMChannel | null;
  const logChannel = await getSetting(guild.id, logType, "channel");

  if (logChannel) {
    channel = await safeChannel(guild, logChannel)
      .then((channel: Channel | null) => (channel?.isTextBased() ? (channel as TextChannel) : null))
      .catch(() => null);

    if (
      channel &&
      (await channelCheck({
        channel,
        guild,
        permType: "Send",
        setting: {
          category: "moderation",
          setting: "channel",
        },
      }))
    )
      await channel.send(options);
  }

  if (shouldDm)
    try {
      if (!dmOptions || dmOptions.isSilent) return;

      channel = await dmOptions.user.createDM().catch(() => null);
      return !channel || !(await safeMember(guild, dmOptions.user.id)) || dmOptions.user.bot
        ? undefined
        : await channel.send(dmOptions.options);
    } catch (error) {
      return await errorEmbed(false, { client: guild.client, error });
    }
}
