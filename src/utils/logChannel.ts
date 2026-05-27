import { getSetting } from "database/settings";
import {
  type Channel,
  type DMChannel,
  type Guild,
  type InteractionResponse,
  type Message,
  type MessageCreateOptions,
  type MessagePayload,
  type TextChannel,
  type User,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "./channelCheck";
import { safeChannel, safeMember } from "./safeThings";

/**
 * Sends a message in the log channel. (if there is one set)
 * @param guild The guild where the log channel is located.
 * @param options Reply options of the log.
 * @param dm Whether or not should the bot send a DM to the user.
 * @param {{
   silent: boolean;
   user: User;
   options: string | MessagePayload | MessageCreateOptions;
 }} dmOptions Options for sending a DM to the user.
 * @returns Log message.
 */
export async function logChannel(
  guild: Guild,
  options: string | MessagePayload | MessageCreateOptions,
  dm?: boolean,
  dmOptions?: {
    silent: boolean;
    user: User;
    options: string | MessagePayload | MessageCreateOptions;
  },
): Promise<undefined | Message | InteractionResponse> {
  let channel: TextChannel | DMChannel | null;
  const logChannel = await getSetting(guild.id, "moderation", "channel");

  if (logChannel) {
    channel = await safeChannel(guild, `${logChannel}`)
      .then((channel: Channel | null) => {
        if (!channel?.isTextBased()) return null;
        return channel as TextChannel;
      })
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

  if (dm)
    try {
      if (!dmOptions) return;
      if (dmOptions.silent) return;

      channel = await dmOptions.user.createDM().catch(() => null);
      if (!channel || !(await safeMember(guild, dmOptions.user.id)) || dmOptions.user.bot) return;
      return await channel.send(dmOptions.options);
    } catch (error) {
      return await errorEmbed({ client: guild.client, error, log: true });
    }
}
