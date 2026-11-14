import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  InteractionContextType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { IS_CANARY, BOT_VERSION } from "const";
import { colorize, Sokolors } from "utils/colorize";
import { pluralOrNot } from "utils/pluralOrNot";
import { replace } from "utils/replace";
import type { GHCommit } from "types";

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("Shows information about Sokora.")
  .setContexts(InteractionContextType.Guild);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = interaction.client;
  const user = await client.user.fetch(true);
  const guilds = client.guilds.cache;
  const members = guilds.map(guild => guild.memberCount).reduce((a, b) => a + b);
  const shards = client.shard?.count;
  const banner = user.bannerURL({ size: 512 });
  const container = new ContainerBuilder();
  if (banner)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)),
    );

  let commit: GHCommit | null = null;

  if (IS_CANARY) {
    const response = await fetch(
      `https://api.github.com/repos/SokoraDesu/Sokora/commits?per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );
    const log = (await response.json()) as [GHCommit];
    commit = log[0];
  }

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## About Sokora"),
      new TextDisplayBuilder().setContent(
        "Sokora is a multipurpose Discord bot that lets you manage your servers easily.",
      ),
      new TextDisplayBuilder().setContent(
        [
          "**📃 • General**",
          `Version **${BOT_VERSION}${commit ? `+[\`${commit.sha.slice(0, 8)}\`](${commit.html_url})` : ""}** • *Heijun*`,
          `**${members.toLocaleString("en-US")}** ${pluralOrNot("member", members)} • **${guilds.size.toLocaleString("en-US")}** ${pluralOrNot(
            "guild",
            guilds.size,
          )}${shards ? ` • **${shards}** ${pluralOrNot("shard", shards)}` : ""}`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**🔗 • Links**",
          "[Discord](https://discord.gg/c6C25P4BuY) • [GitHub](https://www.github.com/SokoraDesu) • [YouTube](https://www.youtube.com/@SokoraDesu) • [Mastodon](https://mastodon.online/@NebulaTheBot@mastodon.social)",
          "Also, please read the [ToS](https://sokora.org/terms) and the [privacy policy](https://sokora.org/privacy).",
        ].join("\n"),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("•  Vote")
          .setURL(`https://top.gg/bot/${user.id}/vote`)
          .setEmoji("🗳️")
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel("•  Donate")
          .setURL("https://ko-fi.com/sokoradesu")
          .setEmoji("☕")
          .setStyle(ButtonStyle.Link),
      ),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${replace("(madeWith)")}`))
    .setAccentColor(
      await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple }),
    );

  await interaction.reply({ components: [container], flags: ["Ephemeral", "IsComponentsV2"] });
}
