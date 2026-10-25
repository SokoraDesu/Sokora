import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  type DMChannel,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type TextChannel,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { channelCheck } from "utils/channelCheck";
import { colorize, Sokolors } from "utils/colorize";
import { replaceVariables } from "utils/replace";
import { safeChannel } from "utils/safeThings";
import type { Event } from "types";

export default (async function run(member) {
  const guild = member.guild;
  const guildID = guild.id;
  const id =
    (await getSetting(guildID, "welcome", "join_channel")) ??
    (await getSetting(guildID, "welcome", "leave_channel"));

  if (!id) return;
  const roles = await getSetting(guildID, "welcome", "roles");
  const user = member.user;
  const avatar = user.displayAvatarURL();
  const banner = user.bannerURL({ size: 512 });

  async function welcomeContainer(shouldDm: boolean): Promise<ContainerBuilder> {
    const container = new ContainerBuilder();
    if (banner)
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)),
      );

    return container
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${user.displayName} joined`),
            new TextDisplayBuilder().setContent(
              shouldDm
                ? await replaceVariables(
                    await getSetting(guildID, "welcome", "dm_text"),
                    guild,
                    user,
                  )
                : await replaceVariables(
                    await getSetting(guildID, "welcome", "join_text"),
                    guild,
                    user,
                  ),
            ),
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
      )
      .setAccentColor(await colorize({ user, avatar, hue: Sokolors.Blue }));
  }

  const channel = (await safeChannel(guild, id)) as TextChannel;
  if (
    await channelCheck({
      guild,
      channel,
      permType: "Send",
      setting: { category: "welcome", setting: "join_channel" },
    })
  ) {
    if (roles && !user.bot) await member.roles.add([...roles]);
    await channel.send({ components: [await welcomeContainer(false)], flags: "IsComponentsV2" });
  }

  if (!(await getSetting(guildID, "welcome", "join_dm"))) return;
  const dmChannel: DMChannel | null = await user.createDM().catch(() => null);
  if (!dmChannel || user.bot) return;

  try {
    await dmChannel.send({ components: [await welcomeContainer(true)], flags: "IsComponentsV2" });
  } catch (error) {
    return await errorEmbed(false, {
      client: member.client,
      error,
      fileName: "guildMemberAdd",
    });
  }
} as Event<"guildMemberAdd">);
