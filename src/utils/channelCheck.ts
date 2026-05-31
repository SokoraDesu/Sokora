import { resetSetting } from "database/settings";
import {
  ChannelType,
  EmbedBuilder,
  type Channel,
  type Guild,
  type GuildBasedChannel,
  type NewsChannel,
  type PermissionResolvable,
  type TextChannel,
} from "discord.js";
import { colorize, Sokolors } from "./colorize";
import { dotCheck } from "./dotCheck";
import { mention } from "./mention";

/** Checks if a channel that the user specified as the value of any setting (moderation.channel for example) is valid.
 *
 * "Valid" = Exists, is either a Text or News channel, and Sokora has the requested permissions for it (either send, view, or both).
 * @param {{
    channel: Channel | GuildBasedChannel | null;
    setting: {
      category: string;
      setting: string;
    };
    permType: "View" | "Send";
    guild: Guild;
 }} options Options.
 */
export async function channelCheck(options: {
  channel: Channel | GuildBasedChannel | null;
  setting: {
    category: string;
    setting: string;
  };
  permType: "View" | "Send";
  guild: Guild;
}): Promise<boolean> {
  const { channel, permType, guild, setting } = options;

  async function reset(): Promise<boolean> {
    await dm?.send({ embeds: [embed] });
    await resetSetting(guild.id, setting.category, setting.setting);
    return false;
  }

  function isValid(channel: Channel): channel is TextChannel | NewsChannel {
    return channel.type == ChannelType.GuildText || channel.type == ChannelType.GuildAnnouncement;
  }

  const user = guild.client.user;
  const avatar = user.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}A channel is misconfigured in your server!`,
      iconURL: avatar,
    })
    .setFields({
      name: "⁉️ • What happened",
      value: channel
        ? (isValid(channel)
          ? `Sokora needs ${permType == "View" ? "**View Channel**" : "both **View Channel** and **Send Messages**"} permission in ${mention(channel.id, "CHANNEL")}, requested by setting \`${setting.category}.${setting.setting}\`, but it doesn't have it anymore. **This setting has been reset to default.**`
          : `Sokora's \`${setting.category}.${setting.setting}\` setting was configured to send messages to a channel that is neither a text nor an announcements channel! We cannot send messages to ${mention(channel.id, "CHANNEL")}. **This setting has been reset to default.**`)
        : `Sokora's \`${setting.category}.${setting.setting}\` setting was configured to send messages to a channel that no longer exists! **This setting has been reset to default.**`,
    })
    .setFooter({ text: `This is coming from ${guild.name} • ID: ${guild.id}` })
    .setColor(await colorize({ hue: Sokolors.Red }));

  const dm = await (await guild.fetchOwner())?.createDM().catch(() => null);
  if (!channel || !isValid(channel)) return await reset();

  const permissions: PermissionResolvable[] = [];
  if (permType == "View") permissions.push("ViewChannel");
  if (permType == "Send") permissions.push("ViewChannel", "SendMessages");

  const perms = channel.permissionsFor(channel.client.user);
  if (!perms) return await reset();
  if (permissions.every(p => perms.has(p))) return true;

  return await reset();
}
