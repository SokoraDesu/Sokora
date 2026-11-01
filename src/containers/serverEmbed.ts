import { resetSetting } from "database/settings";
import {
  ContainerBuilder,
  GuildNSFWLevel,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type NewsChannel,
  type StageChannel,
  type TextChannel,
  type VoiceChannel,
} from "discord.js";
import { logChannel } from "utils/logChannel";
import { pagedButtons } from "utils/pagination";
import { colorize, Sokolors } from "utils/colorize";
import { pluralOrNot } from "utils/pluralOrNot";
import { IS_CANARY } from "const";
import { getServerboardEntry, type ServerboardOptions } from "database/serverboard";
import { buildLogEmbed } from "./logEmbed";

/**
 * Gives you a CONTAINER containing information about the guild.
 * @param options - Options of the container.
 * @returns Container that contains the guild info.
 * TODO(v0.4): check if i can MVC/improve/refactor this or not
 */
export async function serverEmbed(options: ServerboardOptions): Promise<ContainerBuilder> {
  const { page, pages, guild, shouldDisableButtons } = options;
  const {
    channelCount,
    textChannelCount,
    voiceChannelCount,
    createdAt,
    owner,
    iconUrl,
    inviteChannel,
    memberCount,
    has2fa,
    safetyLevel,
    nsfwLevel,
    boostTier,
    boostCount,
    boosterCount,
    roles,
  } = await getServerboardEntry(options);

  const generalValues = [
    `Owned by **${owner.user.displayName}**`,
    `Created on **${createdAt}**`,
  ].join("\n");

  const safetyValues: (string | null)[] = [
    `**${safetyLevel}** level`,
    `**${has2fa ? "Has" : "No"}** 2FA`,
  ];

  if (guild.nsfwLevel != GuildNSFWLevel.Default) safetyValues.push(`**${nsfwLevel}**`);

  const statValues: (string | null)[] = [
    `**${memberCount}** members`,
    voiceChannelCount > 0
      ? `**${channelCount}** ${pluralOrNot("channel", channelCount)} • **${textChannelCount}** text and **${voiceChannelCount}** voice`
      : `**${channelCount}** text ${pluralOrNot("channel", channelCount)}`,
  ];

  if (boostTier)
    statValues.push(
      `${boostTier ? `Level **${boostTier}**` : "**No** level"} • **${boostCount}** ${pluralOrNot("boost", boostCount ?? 0)} • **${boosterCount}** ${pluralOrNot("booster", boosterCount)}`,
    );

  if (options.roles)
    statValues.push(
      `**${roles[1]}** ${pluralOrNot("role", roles[1])} • ${
        roles[1] == 0
          ? "*None*"
          : `${roles[0].join(" • ")}${roles[2] > 0 ? ` and **${roles[2]}** more` : ""}`
      }`,
    );

  const container = new ContainerBuilder();
  const start = [
    new TextDisplayBuilder().setContent(
      `## ${pages && page != undefined && pages > 1 ? `#${page + 1}  •  ` : ""}${guild.name}`,
    ),
    new TextDisplayBuilder().setContent([generalValues, safetyValues.join(" • ")].join("\n")),
  ];

  if (iconUrl)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(start)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)),
    );
  else container.addTextDisplayComponents(start);

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (guild.description)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${guild.description}`),
    );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statValues.join("\n")));

  async function noPerms(
    channel?: NewsChannel | TextChannel | StageChannel | VoiceChannel,
  ): Promise<ContainerBuilder> {
    await resetSetting(guild.id, "serverboard", "server_invite");
    await resetSetting(guild.id, "serverboard", "invite_channel");
    const errorContainer = await buildLogEmbed(
      guild,
      "Serverboard is misconfigured in your server!",
      [
        "Sokora does not have the **Create Invite** and **Manage Server** permissions to create an invitation, but `serverboard.server_invite` is enabled.",
        `Please give Sokora the permission${channel ? ` for ${channel.name}` : ""} and enable the settings again in **/settings serverboard**.`,
      ].join("\n"),
    );

    await logChannel(guild, { components: [errorContainer], flags: "IsComponentsV2" }, true, {
      isSilent: false,
      user: owner.user,
      options: { components: [container], flags: "IsComponentsV2" },
    });

    return container;
  }

  if (inviteChannel == 1) return await noPerms();

  if (inviteChannel != undefined)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `This server allows you to join from here! ${inviteChannel}`,
      ),
    );

  if (pages && pages > 1)
    container.addActionRowComponents(pagedButtons(pages, page, shouldDisableButtons));

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Server ID: ${guild.id}`))
    .setAccentColor(await colorize({ avatar: iconUrl, hue: Sokolors.Blue }));

  if (IS_CANARY)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# **Why is my server here if I did not enable this?** or **Why is some data redacted?**\n-# Sokora Canary doesn’t honor the serverboard enablement setting to allow us to know where the bot is being used and directly contact testers if needed. **To avoid privacy issues, data is somewhat redacted.** The image being absent is also intentional.",
      ),
    );

  return container;
}
