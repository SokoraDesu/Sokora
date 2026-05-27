import { createCase, editCase, getCase, type ModType } from "database/moderation";
import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type ContainerBuilder,
  type InteractionResponse,
  type Message,
  type PermissionResolvable,
  type User,
} from "discord.js";
import ms from "enhanced-ms";
import { mention } from "utils/mention";
import { safeChannel, safeMember, safeReply } from "utils/safeThings";
import { colorize, Sokolors } from "../colorize";
import { dotCheck } from "../dotCheck";
import { logChannel } from "../logChannel";
import { errorEmbed } from "./errorEmbed";

interface Options {
  interaction: ChatInputCommandInteraction;
  action?: string;
  channel?: string;
  user?: User;
  duration?: number | null;
  dm?: boolean;
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
    ownerError?: boolean;
    outsideError?: boolean;
    banCheckError?: boolean;
  };
};

export async function errorCheck(
  permissionAction: string,
  options: ErrorOptions,
): Promise<Message | InteractionResponse | undefined> {
  const { interaction, user, channel, action, errorOptions } = options;
  const { allErrors, botError, channelError, ownerError, outsideError, banCheckError } =
    errorOptions;

  const guild = interaction.guild;
  if (!guild) return;
  const member = await safeMember(guild, interaction.user.id);
  const client = await safeMember(guild, interaction.client.user.id);
  const permission = permissionAction.replaceAll(/\s/g, "") as PermissionResolvable;

  if (botError && !client.permissions.has(permission))
    return await errorEmbed({
      interaction,
      title: "The bot can't execute this command.",
      reason: `The bot is missing the **${permissionAction}** permission. If you want to run this command, you might want to give the bot this permission.`,
    });

  if (channelError) {
    if (!channel)
      return await errorEmbed({
        interaction,
        title: "The bot can't execute this command.",
        reason: "The provided channel does not exist!",
      });
    const fetchedChannel = await safeChannel(guild, channel);
    if (!fetchedChannel) return;
    if (fetchedChannel.isDMBased()) return;
    if (!fetchedChannel.permissionsFor(client).has("ViewChannel"))
      return await errorEmbed({
        interaction,
        title: "The bot can't execute this command.",
        reason:
          "The bot is missing the **View Channel** permission. If you want to run this command, you might want to give the bot this permission from the channel settings.",
      });
  }

  if (!member.permissions.has(permission))
    return await errorEmbed({
      interaction,
      title: "You can't execute this command.",
      reason: `You're missing the **${permissionAction}** permission.`,
    });

  if (banCheckError) {
    if (!user)
      return await errorEmbed({
        interaction,
        title: "You can't ban this user.",
        reason: "This user doesn't exist.",
      });
    const isBanned = (await guild.bans.fetch()).has(user.id);
    if (action == "Ban" && isBanned)
      return await errorEmbed({
        interaction,
        title: "You can't ban this user.",
        reason: "This user is already banned.",
      });
    else if (action == "Unban" && !isBanned)
      return await errorEmbed({
        interaction,
        title: "You can't unban this user.",
        reason: "This user isn't currently banned.",
      });
  }

  if (!allErrors || !user || !action) return;
  const target = await safeMember(guild, user.id);
  const name = user.displayName;
  const highestModPos = member.roles.highest.position;

  if (outsideError && !target)
    return await errorEmbed({
      interaction,
      title: `You can't ${action.toLowerCase()} ${name}.`,
      reason: "This user isn't in this server.",
    });

  if (!target) return;
  const highestTargetPos = target.roles.highest.position;

  if (target == member)
    return await errorEmbed({ interaction, title: `You can't ${action.toLowerCase()} yourself.` });

  if (target.id == interaction.client.user.id)
    return await errorEmbed({ interaction, title: `You can't ${action.toLowerCase()} Sokora.` });

  if (!target.manageable)
    return await errorEmbed({
      interaction,
      title: `You can't ${action.toLowerCase()} ${name}.`,
      reason: "The member has a higher (or the same) role position than Sokora.",
    });

  if (highestModPos <= highestTargetPos && member.id != guild.ownerId) {
    const same: boolean = highestModPos == highestTargetPos;
    return await errorEmbed({
      interaction,
      title: `You can't ${action.toLowerCase()} ${name}.`,
      reason: `The member has ${same ? "the same" : "a higher"} role position ${same ? "as" : "than"} you.`,
    });
  }

  if (ownerError && target.id == guild.ownerId)
    return await errorEmbed({
      interaction,
      title: `You can't ${action.toLowerCase()} ${name}.`,
      reason: "The member owns the server.",
    });
}

export async function modEmbed(
  options: Options & { silent?: boolean },
  reason?: string | null,
): Promise<undefined | Message | InteractionResponse | ContainerBuilder> {
  const {
    interaction,
    user,
    channel,
    action,
    duration,
    dm,
    dbAction,
    expiresAt,
    previousID,
    customText,
    silent,
  } = options;
  const guild = interaction.guild;
  if (!guild) throw new Error("Cannot create modEmbed without a guild!");
  const name = user?.displayName;
  const generalValues = [`**Moderator**: ${interaction.user.displayName}`];
  const serverAvatar = (guild.icon ? guild.iconURL() : undefined) ?? undefined;
  const avatar = user ? user.displayAvatarURL() : serverAvatar;
  let author = `${previousID ? "Edited a " : ""}${previousID ? dbAction?.toLowerCase() : action}${previousID ? " on" : ""} ${name}`;
  if (reason) generalValues.push(`**Reason**: ${reason}`);
  else generalValues.push("*No reason provided*");

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
        title: `You can't edit this ${dbAction?.toLowerCase()}.`,
        reason: `The ${dbAction?.toLowerCase()} doesn't exist.`,
      });

    try {
      await editCase(guild.id, previousID, reason ?? "", expiresAt ?? null);
    } catch (error) {
      return await errorEmbed({
        interaction,
        error,
        log: true,
        forward: true,
        fileName: "modEmbed.ts",
      });
    }
    author += `  •  #${previousID}`;
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

      const id = await createCase(
        guild.id,
        user.id,
        dbAction,
        moderator.id,
        reason ?? undefined,
        expiresAt ?? undefined,
      );
      author += `  •  #${id}`;
    } catch (error) {
      return await errorEmbed({
        interaction,
        error,
        log: true,
        forward: true,
        fileName: "modEmbed.ts",
      });
    }
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${customText?.logTitle ?? author}`,
      iconURL: avatar,
    })
    .setDescription(generalValues.join("\n"))
    .setFooter({ text: user ? `User ID: ${user.id}` : `Channel ID: ${channel}` })
    .setTimestamp(new Date())
    .setColor(await colorize({ hue: Sokolors.Green }));

  async function replier(): Promise<Awaited<ReturnType<typeof safeReply>>> {
    if (silent)
      return await safeReply({
        interaction,
        replyOptions: { embeds: [embed], flags: "Ephemeral" },
      });

    return await safeReply({ interaction, replyOptions: { embeds: [embed] } });
  }

  if (!user)
    throw new Error(
      "modEmbed got to a place where user must be defined (for logChannel) but is somehow not.",
    );

  await Promise.all([
    logChannel(guild, { embeds: [embed] }, dm, {
      silent: silent ?? false,
      user,
      options: {
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `${dotCheck({ string: serverAvatar, doubleSpace: true })}${customText?.dmTitle ?? `You got ${action?.toLowerCase()} from ${guild.name}`}`,
              iconURL: serverAvatar,
            })
            .setDescription(generalValues.join("\n"))
            .setTimestamp(new Date())
            .setColor(await colorize({ hue: Sokolors.Red })),
        ],
      },
    }),
    replier(),
  ]);
}
