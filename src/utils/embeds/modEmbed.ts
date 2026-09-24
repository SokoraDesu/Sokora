import { createCase, editCase, getCase, type ModType } from "database/moderation";
import {
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  type InteractionResponse,
  type Message,
  type PermissionResolvable,
  type User,
} from "discord.js";
import ms from "enhanced-ms";
import { mention } from "utils/mention";
import { safeChannel, safeMember, safeReply } from "utils/safeThings";
import { colorize, Sokolors } from "../colorize";
import { logChannel } from "../logChannel";
import { errorEmbed } from "./errorEmbed";

interface Options {
  interaction: ChatInputCommandInteraction;
  action?: string;
  channel?: string;
  user?: User;
  duration?: number | null;
  shouldDm?: boolean;
  dbAction?: ModType;
  expiresAt?: Date;
  previousID?: number;
  customText?: {
    logTitle: string;
    dmTitle?: string;
  };
}

type ErrorOptions = Options & {
  errorOptions: {
    allErrors: boolean;
    botError: boolean;
    channelError?: boolean;
    outsideError?: boolean;
    banCheckError?: boolean;
  };
};

/**
 * Checks for errors in moderation commands.
 * @param permissionAction The permission that the command requires. If the bot doesn't have it, it errors.
 * @param options Error options.
 * @returns An errorEmbed if something goes wrong.
 */
export async function errorCheck(
  permissionAction: string,
  options: ErrorOptions,
): Promise<Message | InteractionResponse | undefined> {
  const { interaction, user, channel, action, errorOptions } = options;
  const { allErrors, botError, channelError, outsideError, banCheckError } = errorOptions;

  const guild = interaction.guild;
  if (!guild) return;
  const member = await safeMember(guild, interaction.user.id);
  const client = await safeMember(guild, interaction.client.user.id);
  const permission = permissionAction.replaceAll(/\s/g, "") as PermissionResolvable;

  if (botError && !client.permissions.has(permission))
    return await errorEmbed({
      interaction,
      title: "The bot can’t execute this command.",
      reason: `The bot is missing the **${permissionAction}** permission. If you want to run this command, you might want to give the bot this permission.`,
    });

  if (channelError) {
    if (!channel)
      return await errorEmbed({
        interaction,
        title: "The bot can’t execute this command.",
        reason: "The provided channel does not exist!",
      });

    const fetchedChannel = await safeChannel(guild, channel);
    if (!fetchedChannel) return;
    if (fetchedChannel.isDMBased()) return;
    if (!fetchedChannel.permissionsFor(client).has("ViewChannel"))
      return await errorEmbed({
        interaction,
        title: "The bot can’t execute this command.",
        reason:
          "The bot is missing the **View Channel** permission. If you want to run this command, you might want to give the bot this permission from the channel settings.",
      });
  }

  if (!member.permissions.has(permission))
    return await errorEmbed({
      interaction,
      title: "You can’t execute this command.",
      reason: `You’re missing the **${permissionAction}** permission.`,
    });

  if (banCheckError) {
    if (!user)
      return await errorEmbed({
        interaction,
        title: "You can’t ban this user.",
        reason: "This user doesn’t exist.",
      });

    const isBanned = (await guild.bans.fetch()).has(user.id);
    if (isBanned && action == "Ban")
      return await errorEmbed({
        interaction,
        title: "You can’t ban this user.",
        reason: "This user is already banned.",
      });

    if (!isBanned && action == "Unban")
      return await errorEmbed({
        interaction,
        title: "You can’t unban this user.",
        reason: "This user isn’t currently banned.",
      });
  }

  if (!allErrors || !user || !action) return;
  const target = await safeMember(guild, user.id);
  const name = user.displayName;

  if (outsideError && !target)
    return await errorEmbed({
      interaction,
      title: `You can’t ${action.toLowerCase()} ${name}.`,
      reason: "This user isn’t in this server.",
    });

  if (!target) return;

  if (target == member)
    return await errorEmbed({ interaction, title: `You can’t ${action.toLowerCase()} yourself.` });

  if (target.id == interaction.client.user.id)
    return await errorEmbed({ interaction, title: `You can’t ${action.toLowerCase()} Sokora.` });

  if (!target.moderatable)
    return await errorEmbed({
      interaction,
      title: `You can’t ${action.toLowerCase()} ${name}.`,
      reason: [
        "The member cannot be moderated by Sokora.\n",
        "**There are three reasons as to why this error might occur:**",
        "- The member has a higher role position than the bot;",
        "- The member is an administrator;",
        "- The member is the owner of the server.",
      ].join("\n"),
    });

  const highestModPos = member.roles.highest.position;
  const highestTargetPos = target.roles.highest.position;

  if (highestModPos <= highestTargetPos && member.id != guild.ownerId) {
    const isSamePos: boolean = highestModPos == highestTargetPos;
    return await errorEmbed({
      interaction,
      title: `You can’t ${action.toLowerCase()} ${name}.`,
      reason: `The member has ${isSamePos ? "the same" : "a higher"} role position ${isSamePos ? "as" : "than"} you.`,
    });
  }
}

/**
 * Sends a container containing information about a moderation action.
 * @param options Options
 * @param reason Reason for the moderation action.
 * @returns A container with action info (or an errorEmbed if something goes wrong).
 */
export async function modEmbed(
  options: Options & { isSilent?: boolean },
  reason?: string | null,
): Promise<undefined | Message | InteractionResponse | number> {
  const {
    interaction,
    user,
    channel,
    action,
    duration,
    shouldDm,
    dbAction,
    expiresAt,
    previousID,
    customText,
    isSilent,
  } = options;
  const guild = interaction.guild;
  if (!guild) throw new Error("Cannot create modEmbed without a guild!");
  const generalValues = [`**Moderator**: ${interaction.user.displayName}`];
  const serverAvatar = (guild.icon ? guild.iconURL() : undefined) ?? undefined;
  const avatar = user ? user.displayAvatarURL() : serverAvatar;
  let title = `${previousID ? "Edited a " : ""}${previousID ? dbAction?.toLowerCase() : action}${previousID ? " on" : ""}${user ? mention(user.id, "USER") : ""}`;
  let caseId;

  if (reason) generalValues.push(`**Reason**: ${reason}`);
  if (duration) generalValues.push(`**Duration**: ${ms(duration, "fullPrecision")}`);
  if (channel) generalValues.push(`**Channel**: ${mention(channel, "CHANNEL")}`);
  if (previousID) {
    const previousCase = await getCase(guild.id, previousID);
    if (
      (previousCase.length === 0 && previousCase[0].userID != user?.id) ||
      previousCase[0].type != dbAction
    )
      return await errorEmbed({
        interaction,
        title: `You can’t edit this ${dbAction?.toLowerCase()}.`,
        reason: `The ${dbAction?.toLowerCase()} doesn’t exist.`,
      });

    try {
      await editCase(guild.id, previousID, reason ?? "", expiresAt ?? null);
    } catch (error) {
      return await errorEmbed({
        interaction,
        error,
        log: true,
        forward: true,
        fileName: "modEmbed",
      });
    }
    title += `  •  #${previousID}`;
  }

  if (dbAction) {
    if (!action || !user) return;
    try {
      const moderator = await safeMember(guild, interaction.user.id);
      if (!moderator)
        return await errorEmbed({
          interaction,
          title: `Failed to ${action.toLowerCase()}.`,
          reason: "Cannot find the moderator.",
        });

      caseId = await createCase(
        guild.id,
        user.id,
        dbAction,
        moderator.id,
        reason ?? undefined,
        expiresAt ?? undefined,
      );
      title += `  •  #${caseId}`;
    } catch (error) {
      return await errorEmbed({
        interaction,
        error,
        log: true,
        forward: true,
        fileName: "modEmbed",
      });
    }
  }

  const textDisplayComponents = [
    new TextDisplayBuilder().setContent(`**${customText?.logTitle ?? title}**`),
    new TextDisplayBuilder().setContent(generalValues.join("\n")),
    new TextDisplayBuilder().setContent(
      `-# ${user ? `User ID: ${user.id}` : `Channel ID: ${channel}`} • ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`,
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

  async function replier(): Promise<Awaited<ReturnType<typeof safeReply>>> {
    if (isSilent)
      return await safeReply({
        interaction,
        replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
      });

    return await safeReply({
      interaction,
      replyOptions: { components: [container], flags: "IsComponentsV2" },
    });
  }

  await Promise.all([
    logChannel(
      guild,
      { components: [container], flags: "IsComponentsV2" },
      shouldDm,
      user
        ? {
            isSilent: isSilent ?? false,
            user,
            options: {
              components: [
                new ContainerBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                      customText?.dmTitle ??
                        `**You got ${action?.toLowerCase()} from ${guild.name}**`,
                    ),
                    new TextDisplayBuilder().setContent(generalValues.join("\n")),
                    new TextDisplayBuilder().setContent(
                      `-# ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`,
                    ),
                  )
                  .setAccentColor(await colorize({ hue: Sokolors.Red })),
              ],
              flags: "IsComponentsV2",
            },
          }
        : undefined,
    ),
    replier(),
  ]);

  return caseId;
}
