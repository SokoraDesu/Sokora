import {
  ContainerBuilder,
  GuildMember,
  InteractionContextType,
  PermissionFlagsBits,
  PermissionsBitField,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
  type Role,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { pluralOrNot } from "utils/pluralOrNot";
import { assertInteraction } from "types";

export function lacksPerm(
  entityPermissions: PermissionsBitField,
  desiredPermissions: PermissionsBitField,
): (keyof typeof PermissionFlagsBits)[] {
  const missing = new PermissionsBitField();

  for (const permission of desiredPermissions)
    if (!entityPermissions.has(permission)) missing.add(permission);

  return missing.toArray();
}

function permCheckFormat(
  permissions: PermissionsBitField,
  permissionLabel: string,
  permissionExplanation: string,
  issues: string[],
): [TextDisplayBuilder, number] {
  const permissionArray = permissions.toArray();
  const permissionString = permissionArray.map(s => `\`${s}\``).join(", ");

  return issues.length === 0
    ? [
        new TextDisplayBuilder().setContent(
          `✅ • Sokora **can** ${permissionLabel}.\n-# Checked for ${permissionString}.`,
        ),
        0,
      ]
    : [
        new TextDisplayBuilder().setContent(
          `❌ • Sokora **can’t** ${permissionLabel}. It **lacks the ${issues.join(", ")}** permission. ${permissionExplanation}.\n-# Checked for ${permissionString}`,
        ),
        1,
      ];
}

function getRoleError(
  botMember: GuildMember,
  targetMember: GuildMember,
):
  | {
      botHighest: Role;
      targetHighest: Role;
      issues: Role[];
    }
  | undefined {
  if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
    const blockingRoles = targetMember.roles.cache
      .filter(role => role.position >= botMember.roles.highest.position)
      .sort((a, b) => b.position - a.position);

    return {
      botHighest: botMember.roles.highest,
      targetHighest: targetMember.roles.highest,
      issues: blockingRoles.values().toArray(),
    };
  }

  return;
}

export const data = new SlashCommandBuilder()
  .setName("permcheck")
  .setDescription("Shows information about Sokora.")
  .setContexts(InteractionContextType.Guild)
  .addUserOption(user => {
    return user
      .setName("user")
      .setDescription("Check permissions over a specific user.")
      .setRequired(false);
  })
  .addChannelOption(channel => {
    return channel
      .setName("channel")
      .setDescription("Check permissions over a specific channel.")
      .setRequired(false);
  });

const CHANNEL_PERMS = new PermissionsBitField([
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
]);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const container = new ContainerBuilder();
  const user = interaction.options.getMember("user");

  if (user && !(user instanceof GuildMember))
    throw new Error(
      `Unsafe guild member (instead of GuildMember type it has this weird APIWhatever type). ${interaction.guildId} while running permcheck.`,
    );

  const channel = interaction.options.getChannel("channel");

  let errorCount = 0;
  let warningCount = 0;
  const genericComponents: TextDisplayBuilder[] = [];
  const userComponents: TextDisplayBuilder[] = [];
  const channelComponents: TextDisplayBuilder[] = [];

  if (user || channel) {
    if (user)
      if (user.moderatable)
        userComponents.push(
          new TextDisplayBuilder().setContent(
            `✅ • Sokora **can** moderate ${mention(user.id, "USER")}.\n-# Checked for \`GuildMember#moderatable\`.`,
          ),
        );
      else if (user.id === interaction.guild.ownerId) {
        userComponents.push(
          new TextDisplayBuilder().setContent(
            `🟡 • Sokora **can’t** moderate ${mention(user.id, "USER")}, but **it’s not an issue since they own the guild**.`,
          ),
        );
        warningCount++;
      } else if (user.permissions.has(PermissionFlagsBits.Administrator)) {
        userComponents.push(
          new TextDisplayBuilder().setContent(
            `🟡 • Sokora **can’t** moderate ${mention(user.id, "USER")}, but **it’s not an issue since they are a guild administrator**.`,
          ),
        );
        warningCount++;
      } else {
        const roleCheck = getRoleError(interaction.guild.members.me, user);
        const reason = roleCheck
          ? `**This is because they have a higher role position.**\n${mention(roleCheck.botHighest.id, "ROLE")} is Sokora’s highest role, which compared to ${mention(roleCheck.targetHighest.id, "ROLE")} (user’s highest), is ${roleCheck.issues.length} roles below`
          : `**Weirdly, there’s no clear explanation for this error.** If you report this issue to us you’d do us a great favor`;
        userComponents.push(
          new TextDisplayBuilder().setContent(
            `❌ • Sokora **can’t** moderate ${mention(user.id, "USER")}. ${reason}.`,
          ),
        );
        errorCount++;
      }

    if (channel) {
      const [component, sum] = permCheckFormat(
        CHANNEL_PERMS,
        "work with this channel",
        "Needed to work with this channel.",
        lacksPerm(interaction.guild.members.me.permissionsIn(channel.id), CHANNEL_PERMS),
      );
      channelComponents.push(component);
      errorCount += sum;
    }
  } else
    for (const tuple of [
      [
        CHANNEL_PERMS,
        "read and send messages and attachments",
        "Needed for the bot to properly function!",
      ],
      [
        new PermissionsBitField([
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.UseExternalEmojis,
        ]),
        "add reactions",
        "Needed for properly communicating.",
      ],
      [
        new PermissionsBitField([
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.BanMembers,
          PermissionFlagsBits.KickMembers,
        ]),
        "moderate members",
        "Needed for moderation features.",
      ],
      [
        new PermissionsBitField([
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageRoles,
          PermissionFlagsBits.ManageGuild,
        ]),
        "manage channels and messages",
        "Needed for moderation features.",
      ],
      [
        new PermissionsBitField([PermissionFlagsBits.CreateInstantInvite]),
        "create invites",
        "Needed for setting `serverboard.show_invite`",
      ],
    ] as const) {
      const [component, sum] = permCheckFormat(
        tuple[0],
        tuple[1],
        tuple[2],
        lacksPerm(interaction.guild.members.me.permissions, tuple[0]),
      );
      genericComponents.push(component);
      errorCount += sum;
    }

  const totalIssues = errorCount + warningCount;
  if (totalIssues == 0)
    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Everything seems good!"))
      .setAccentColor(await colorize({ hue: Sokolors.Green }));
  else
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Found${errorCount > 0 ? ` ${errorCount} permission ${pluralOrNot("issue", errorCount)}` : ""}${warningCount > 0 ? ` ${errorCount > 0 ? "and " : ""}${warningCount} ${pluralOrNot("warning", warningCount)}` : ""}`,
        ),
      )
      .setAccentColor(await colorize({ hue: errorCount == 0 ? Sokolors.Yellow : Sokolors.Red }));

  if (genericComponents.length === 0)
    if (userComponents.length > 0 && channelComponents.length > 0)
      container
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("### Issues with the user"))
        .addTextDisplayComponents(userComponents)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### Issues with the channel"),
        )
        .addTextDisplayComponents(channelComponents);
    else
      container.addTextDisplayComponents(
        userComponents.length > 0 ? userComponents : channelComponents,
      );
  else container.addTextDisplayComponents(genericComponents);

  await interaction.reply({ components: [container], flags: ["Ephemeral", "IsComponentsV2"] });
}
