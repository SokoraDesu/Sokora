import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { commands } from "handlers/commands";
import { IS_CANARY } from "const";
import { colorize, Sokolors } from "utils/colorize";
import { replace } from "utils/replace";
import { safeAlertChannel } from "utils/safeThings";
import type { Event } from "types";
import { errorEmbed } from "embeds/errorEmbed";

export default (async function run(guild) {
  const client = guild.client;
  const user = client.user;
  const banner = user.bannerURL({ size: 512 });
  const container = new ContainerBuilder();
  if (banner)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)),
    );

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        IS_CANARY
          ? "## Hey!! You are running **Sokora Canary**!"
          : `## Welcome to ${client.user.username}!`,
      ),
      new TextDisplayBuilder().setContent(
        IS_CANARY
          ? [
              "You probably already know what Sokora is so we’ll skip the welcome text.\n",
              "Whenever our devs push an update, you get it immediately, and **a message with the commit log will be sent**. This goes to your moderation logging channel if set and to the first available server channel otherwise. Set a moderation logging channel with `/settings moderation`, set `Channel` to whatever channel you want to use. Sokora Canary is unaware of regular Sokora’s settings, so do this even if Sokora already has one.\n",
              "> By using this bot you get to try features early, which also means you get to find issues before anyone else. The idea is simple: you deliberately test the bot in all ways you know and report any bug (or general feedback) you find to us. YOU HELP A LOT BY DOING THIS, THANK YOU SO MUCH!!",
              "\nUsers who successfully report issues will be credited in the next stable release. Thank you again, happy testing!",
            ].join("\n")
          : [
              "Sokora is a multipurpose Discord bot that lets you manage your servers easily.",
              "To configure the bot, use the **/settings** command.\n",
              "Sokora is in an early stage of development. If you find bugs, please go to our [official server](https://discord.gg/c6C25P4BuY).",
            ].join("\n"),
      ),
    )
    .setAccentColor(
      await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple }),
    );

  if (!IS_CANARY)
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "**Sokora is in an early stage of development.**",
            "If you find bugs, please go to our [official server](https://discord.gg/c6C25P4BuY).",
          ].join("\n"),
        ),
        new TextDisplayBuilder().setContent(`-# ${replace("(madeWith)")}`),
      );

  await guild.commands.set(commands.map(command => command.data));
  try {
    const welcomeChannel = await safeAlertChannel(guild);
    if (!welcomeChannel.permissionsFor(guild.client.user)?.has("SendMessages")) return;
    await welcomeChannel.send({ components: [container], flags: "IsComponentsV2" });
  } catch (error) {
    return await errorEmbed(true, { client, error, fileName: "guildCreate" });
  }
} as Event<"guildCreate">);
