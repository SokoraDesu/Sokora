import type { ModType } from "database/moderation";
import {
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  ContainerBuilder,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";
import ms from "enhanced-ms";
import { mention } from "utils/mention";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import type { ModEmbedOptions } from "types";

function produceGeneralValues(modAction: ModEmbedOptions): string[] {
  const { moderator, reason, duration, channel } = modAction;
  const generalValues = [`**Moderator**: ${moderator.displayName}`];
  if (reason) generalValues.push(`**Reason**: ${reason}`);
  if (duration) generalValues.push(`**Duration**: ${ms(duration, "fullPrecision")}`);
  if (channel) generalValues.push(`**Channel**: ${mention(channel.id, "CHANNEL")}`);
  return generalValues;
}

function produceVerb(action: ModType, hasRemovedSlowdown: boolean, isPast: boolean): string {
  if (hasRemovedSlowdown && action == "SLOWDOWN")
      return isPast ? "slowdown (setting it to zero)" : "Removed slowdown from";
    

  const dict = {
    MUTE: "Muted",
    UNMUTE: "Unmuted",
    WARN: "Warned",
    KICK: "Kicked",
    BAN: "Banned",
    UNBAN: "Unbanned",
    LOCK: "Locked",
    UNLOCK: "Unlocked",
    SLOWDOWN: "Slowed down",
    CLEAR: "Cleared",
  } as Record<typeof action, string>;

  const editedDict = {
    MUTE: "mute",
    UNMUTE: "unmute",
    WARN: "warning",
    KICK: "kick",
    BAN: "ban",
    UNBAN: "unban",
    LOCK: "channel lock",
    UNLOCK: "channen unlock",
    SLOWDOWN: "slowdown",
    CLEAR: "clear",
  } as Record<typeof action, string>;

  const verbAction = (isPast ? editedDict : dict)[action];

  return verbAction;
}

const isUser = (thing: object): thing is User => Object.hasOwn(thing, "displayAvatarURL");

/**
 * Sends a container containing information about a moderation action.
 * @param options - Options
 * @param reason - Reason for the moderation action.
 * @returns A container with action info (or an errorEmbed if something goes wrong).
 */
async function buildModEmbed(modAction: ModEmbedOptions): Promise<ContainerBuilder> {
  const { guild, target, previousCaseId, caseId, action, customText } = modAction;
  const verb = produceVerb(
    action,
    modAction.expiresAt ? false : true,
    previousCaseId ? true : false,
  );
  const generalValues = produceGeneralValues(modAction);
  const serverAvatar = (guild.icon ? guild.iconURL() : undefined) ?? undefined;
  const avatar = target && isUser(target) ? target.displayAvatarURL() : serverAvatar;
  let title = `${previousCaseId ? "Edited a " : ""}${previousCaseId ? verb?.toLowerCase() : verb}${previousCaseId ? " on" : ""} ${target ? (isUser(target) ? mention(target.id, "USER") : mention(target.id, "CHANNEL")) : ""}`;

  if (previousCaseId ?? caseId) title += `  •  #${previousCaseId ?? caseId}`;

  const textDisplayComponents = [
    new TextDisplayBuilder().setContent(`**${customText?.logTitle ?? title}**`),
    new TextDisplayBuilder().setContent(generalValues.join("\n")),
    new TextDisplayBuilder().setContent(
      `-# ${isUser(target) ? `User ID: ${target.id}` : `Channel ID: ${target.id}`} • ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`,
    ),
  ];

  const container = new ContainerBuilder().setAccentColor(await colorize({ hue: Sokolors.Green }));
  if (avatar)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(textDisplayComponents)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );
  else container.addTextDisplayComponents(textDisplayComponents);

  return container;
}

async function buildDmModEmbed(modAction: ModEmbedOptions): Promise<ContainerBuilder> {
  const { guild, action, customText } = modAction;
  const generalValues = produceGeneralValues(modAction);

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        customText?.dmTitle ?? `**You got ${action?.toLowerCase()} from ${guild.name}**`,
      ),
      new TextDisplayBuilder().setContent(generalValues.join("\n")),
      new TextDisplayBuilder().setContent(`-# ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));
}

/**
 * Creates an embed for a moderation action and sends it to the current channel as well as the log channel (if any). Optionally sends the user a DM if needed.
 *
 * @param options - Options for the embed.
 * @param shouldDm - Set to true if the targeted user should be DMed.
 */
export async function modEmbed(
  options: ModEmbedOptions & { shouldDm?: boolean; interaction: ChatInputCommandInteraction },
): Promise<void> {
  const container = await buildModEmbed(options);

  await logChannel(
    options.guild,
    { components: [container], flags: "IsComponentsV2" },
    options.shouldDm,
    options.target && isUser(options.target)
      ? {
          isSilent: options.isSilent ?? false,
          user: options.target,
          options: {
            components: [await buildDmModEmbed(options)],
            flags: "IsComponentsV2",
          },
        }
      : undefined,
  );

  await options.interaction.reply({
    flags: options.isSilent ? ["IsComponentsV2", "Ephemeral"] : "IsComponentsV2",
    components: [container],
  });
}
