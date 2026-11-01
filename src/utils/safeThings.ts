import { getSetting } from "database/settings";
import {
  ComponentType,
  type OmitPartialGroupDMChannel,
  type AnySelectMenuInteraction,
  type BaseFetchOptions,
  type ButtonInteraction,
  type Channel,
  ChannelType,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  type DMChannel,
  type Guild,
  type GuildMember,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionResponse,
  type Message,
  type MessagePayload,
  type ModalSubmitInteraction,
  type NewsChannel,
  type RepliableInteraction,
  type Role,
  type TextChannel,
  type User,
  type ThreadChannel,
  type PartialDMChannel,
  type PartialGroupDMChannel,
} from "discord.js";
import { as, assertMessage, type SafeMessage } from "types";

/**
 * Ensures that the channel that you're getting will be gotten.
 * @param option - The guild or the client where the channel resides.
 * @param id - The ID of the channel.
 * @returns A channel.
 */
export async function safeChannel(option: Guild | Client, id: string): Promise<Channel> {
  const res = option.channels.cache.get(id) ?? (await option.channels.fetch(id));
  if (!res) throw new Error(`Channel ${id} was NOT found.`);
  return res;
}

type DMChannelAlias = DMChannel | PartialDMChannel | PartialGroupDMChannel;

/**
 * Wraps a {@link safeChannel} call and typechecks the channel, returning `null` if it does not match the desired type.
 * @param option - The guild or the client where the channel resides.
 * @param id - The ID of the channel.
 * @param desired - Channel type you want. This is based on known combos used across Sokora and manually maintained.
 * @returns
 */
export async function safeTypedChannel(
  option: Guild | Client,
  id: string,
  desired: "AnyTextable",
): Promise<TextChannel | NewsChannel | ThreadChannel | null>;
export async function safeTypedChannel(
  option: Guild | Client,
  id: string,
  desired: "DM",
): Promise<DMChannelAlias | null>;
export async function safeTypedChannel(
  option: Guild | Client,
  id: string,
  desired: "NewsOrText",
): Promise<TextChannel | NewsChannel | null>;
export async function safeTypedChannel(
  option: Guild | Client,
  id: string,
  desired: "NewsOnly",
): Promise<NewsChannel | null>;
export async function safeTypedChannel(
  option: Guild | Client,
  id: string,
  desired: "AnyTextable" | "DM" | "NewsOrText" | "NewsOnly",
): Promise<TextChannel | NewsChannel | ThreadChannel | DMChannelAlias | null> {
  const channel = await safeChannel(option, id);
  if (!channel?.isTextBased()) return null;

  if (desired === "DM") return channel.isDMBased() ? channel : null;

  const isNews = channel.type === ChannelType.GuildAnnouncement;

  if (desired === "NewsOnly") return isNews ? channel : null;

  const isText = channel.type === ChannelType.GuildText;

  if (desired === "NewsOrText") return isText || isNews ? channel : null;

  if (desired === "AnyTextable") return isText || isNews || channel.isThread() ? channel : null;

  return null;
}

/**
 * Ensures that the role that you're getting will be gotten.
 * @param guild - The guild where the role resides.
 * @param id - The ID of the role.
 * @returns A role.
 */
export async function safeRole(guild: Guild, id: string): Promise<Role> {
  const res = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id));
  if (!res) throw new Error(`Role ${id} was NOT found.`);
  return res;
}

/**
 * Ensures that the member that you're getting will be gotten.
 * @param guild - The guild where the member resides.
 * @param id - The ID of the member.
 * @returns A member.
 */
export async function safeMember(guild: Guild, id: string): Promise<GuildMember> {
  return guild.members.cache.get(id) ?? (await guild.members.fetch(id));
}

export async function safeMembers(guild: Guild): Promise<Collection<string, GuildMember>> {
  return guild.members.cache ?? (await guild.members.fetch());
}

/**
 * Ensures that the user that you're getting will be gotten.
 * @param client - The client where the user resides.
 * @param id - The ID of the user.
 * @returns A user.
 */
export async function safeUser(
  client: Client,
  id: string,
  force?: BaseFetchOptions,
): Promise<User> {
  return client.users.cache.get(id) ?? (await client.users.fetch(id, force));
}

/**
 * Ensures that the guild that you're getting will be gotten.
 * @param client - The client where the guild resides.
 * @param id - The ID of the guild.
 * @returns A guild.
 */
export async function safeGuild(client: Client, id: string): Promise<Guild> {
  return client.guilds.cache.get(id) ?? (await client.guilds.fetch(id));
}

/**
 * Properly handles replying/following up to an interaction.
 * @param options - Options.
 * @returns The reply.
 */
export async function safeReply(options: {
  interaction: RepliableInteraction;
  replyOptions: string | MessagePayload | InteractionReplyOptions;
}): Promise<Message | InteractionResponse> {
  const { interaction, replyOptions } = options;

  if (interaction.replied || interaction.deferred) return await interaction.followUp(replyOptions);

  return interaction.isButton() || interaction.isAnySelectMenu()
    ? await interaction.reply(replyOptions)
    : await interaction.reply(replyOptions);
}

/**
 * Properly handles editing the response/follow up to an interaction.
 * @param options - Options.
 * @returns The reply
 */
export async function safeEdit(options: {
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | AnySelectMenuInteraction
    | ModalSubmitInteraction;
  editOptions: InteractionEditReplyOptions;
}): Promise<Message | InteractionResponse> {
  const { interaction, editOptions } = options;

  if (interaction.replied || interaction.deferred) return await interaction.editReply(editOptions);

  if (interaction.isButton() || interaction.isAnySelectMenu())
    return await interaction.update(editOptions);

  throw new Error("Should’ve probably used safeReply instead of safeEdit.");
}

function isTextableRegularChannel(
  c: Channel | null | undefined,
  me: GuildMember,
): c is NewsChannel | DMChannel | TextChannel {
  return (
    (c &&
      !c.isDMBased() &&
      c.viewable &&
      c.permissionsFor(me).has("SendMessages") &&
      c.isTextBased() &&
      !c.isThread() &&
      c.isSendable() &&
      !c.isVoiceBased()) ??
    false
  );
}

/**
 * Finds a channel to send important stuff to. This is only for things like welcome, canary updates or important alerts.
 * It tries, in order: logChannel, guild's system channel, owner's DM and first text channel in guild Sokora can text to as a last resort.
 *
 * If SOMEHOW nowhere is it possible to message, throws an Error.
 *
 * @param guild - Guild to find a channel in.
 */
export async function safeAlertChannel(
  guild: Guild,
  shouldDmOwner: true,
): Promise<DMChannel | TextChannel>;
export async function safeAlertChannel(guild: Guild, shouldDmOwner?: false): Promise<TextChannel>;
export async function safeAlertChannel(
  guild: Guild,
  shouldDmOwner?: boolean,
): Promise<DMChannel | NewsChannel | TextChannel> {
  const me = guild.members.me;
  if (!me) throw new Error("how??? this shouldn’t happen…");

  const logChannelId = await getSetting(guild.id, "moderation", "channel");
  const _logChannel = logChannelId ? await guild.channels.fetch(logChannelId) : null;
  const logChannel = isTextableRegularChannel(_logChannel, me) ? _logChannel : null;
  const dmChannel = shouldDmOwner ? await (await guild.fetchOwner()).user.createDM() : null;
  const sysChannel = isTextableRegularChannel(guild.systemChannel, me) ? guild.systemChannel : null;

  const channel: NewsChannel | DMChannel | TextChannel | undefined =
    logChannel ??
    sysChannel ??
    dmChannel ??
    guild.channels.cache
      .filter(c => isTextableRegularChannel(c, me))
      .sort((a, b) => b.position - a.position)
      .last();

  if (!channel)
    throw new Error(
      "the user has done black magic to achieve this, so the bot cannot send anything in this entire server.",
    );

  return channel;
}

export async function safeMessage(
  message: OmitPartialGroupDMChannel<Message>,
  shouldAssert: false,
): Promise<OmitPartialGroupDMChannel<Message>>;
export async function safeMessage(
  message: OmitPartialGroupDMChannel<Message>,
  shouldAssert: true,
): Promise<SafeMessage>;
export async function safeMessage(
  message: OmitPartialGroupDMChannel<Message>,
  shouldAssert: boolean,
): Promise<SafeMessage | OmitPartialGroupDMChannel<Message>> {
  if (message.partial) await message.fetch();
  if (shouldAssert) assertMessage(message);
  message.content = (
    message.content === "" && message.components.length > 0
      ? (message.components[0].type === ComponentType.TextDisplay
        ? message.components[0].content
        : "")
      : message.content
  ).trim();
  return as<SafeMessage>(message);
}

/**
 * Generates a unique cID based on current time and gives it to you. Use this when you care about interaction uniqueness, since the Discord API doesn’t seem to do so.
 *
 * When encoding data within the cID, remove the last `@` from it and whatever that goes after (a random time-based string).
 *
 * @param cid - Actual ID (e.g. `submit_this`)
 * @returns Unique ID (e.g. `submit_this@mt7lb9nd`)
 */
export function safeCustomId(cid: string): string {
  if (cid.length > 90)
    throw new Error(`Safe custom ID cannot exceed 90 characters in length. Caused by ${cid}.`);

  return `${cid}@${Date.now().toString(36)}`;
}
