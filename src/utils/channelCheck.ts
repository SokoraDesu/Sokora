import { resetSetting, type TS } from "database/settings";
import {
  ChannelType,
  ContainerBuilder,
  type TextBasedChannel,
  TextDisplayBuilder,
  type Channel,
  type Guild,
  type GuildBasedChannel,
  type NewsChannel,
  type PermissionResolvable,
  type TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import { colorize, Sokolors } from "./colorize";
import { mention } from "./mention";
import type { SettingKeyFor } from "database/types";

/** Checks if a channel that the user specified as the value of any setting (moderation.channel for example) is valid.
 * "Valid" = Exists, is either a Text or News channel, and Sokora has the requested permissions for it (either send, view, or both).
 * @param options Options.
 * @returns Status of the channel. (if the bot can view it/send in it or not)
 */
export async function channelCheck<K extends keyof TS>(options: {
  channel: Channel | GuildBasedChannel | null;
  setting: {
    category: K;
    setting: SettingKeyFor<K>;
  };
  permType: "View" | "Send";
  guild: Guild;
}): Promise<boolean> {
  const { channel, permType, guild, setting } = options;

  async function reset(): Promise<boolean> {
    await dm?.send({ components: [container], flags: "IsComponentsV2" });
    await resetSetting(guild.id, setting.category, setting.setting);
    return false;
  }

  function isValid(channel: Channel): channel is TextChannel | NewsChannel {
    return channel.type == ChannelType.GuildText || channel.type == ChannelType.GuildAnnouncement;
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## A channel is misconfigured in your server!"),
      new TextDisplayBuilder().setContent(
        channel
          ? (isValid(channel)
            ? `Sokora needs ${permType == "View" ? "**View Channel**" : "both **View Channel** and **Send Messages**"} permission in ${mention(channel.id, "CHANNEL")}, requested by setting \`${setting.category}.${setting.setting}\`, but it doesn’t have it anymore. **This setting has been reset to default.**`
            : `Sokora’s \`${setting.category}.${setting.setting}\` setting was configured to send messages to a channel that is neither a text nor an announcements channel! We cannot send messages to ${mention(channel.id, "CHANNEL")}. **This setting has been reset to default.**`)
          : `Sokora’s \`${setting.category}.${setting.setting}\` setting was configured to send messages to a channel that no longer exists! **This setting has been reset to default.**`,
      ),
      new TextDisplayBuilder().setContent(`-# This is coming from ${guild.name} • ID: ${guild.id}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

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

/** Checks if the bot has the specified permissions in a given guild channel
 * @param channel Channel.
 * @param permissions Permission name or bitfield.
 * @returns Boolean indicating whether yes or no the bot has enough permissions
 */
export function hasChannelPerms(
  channel: TextBasedChannel,
  permissions: PermissionResolvable | (keyof typeof PermissionFlagsBits)[],
): boolean {
  if (Array.isArray(permissions))
    permissions = permissions
      .map(perm => PermissionFlagsBits[perm])
      .reduce((allPerms, perm) => allPerms | perm, 0n);

  return (
    (!channel.isDMBased() && channel.guild.members.me?.permissionsIn(channel).has(permissions)) ??
    false
  );
}
