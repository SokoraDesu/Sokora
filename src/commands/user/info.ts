import {
  calculateLevel,
  getGuildLeaderboard,
  getUserXp,
  getXpForNextLevel,
} from "database/leveling";
import { getSetting } from "database/settings";
import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { pluralOrNot } from "utils/pluralOrNot";
import { replace } from "utils/replace";
import { safeMember, safeMembers } from "utils/safeThings";

export const data = new SlashCommandSubcommandBuilder()
  .setName("info")
  .setDescription("Shows your (or another user's) info.")
  .addUserOption(user => user.setName("user").setDescription("Select the user."));

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const user = await (interaction.options.getUser("user") ?? interaction.user).fetch(true);
  const name = user.displayName;
  let avatar = user.displayAvatarURL();
  let banner = user.bannerURL({ size: 512 });
  let serverInfo;

  if ((await safeMembers(guild)).has(user.id)) {
    const target = await safeMember(guild, user.id);
    avatar = target.displayAvatarURL();
    banner = target.displayBannerURL({ size: 512 });
    serverInfo = [];

    const guildRoles = guild.roles.cache.filter(role => target.roles.cache.has(role.id));
    const memberRoles = [...guildRoles].toSorted(
      (role1, role2) => role2[1].position - role1[1].position,
    );
    memberRoles.pop();
    const rolesLength = memberRoles.length;
    const xp = await getUserXp(guild.id, target.id);
    const nextLevelXp = await getXpForNextLevel(guild.id, user.id);
    const difficulty = (await getSetting(guild.id, "leveling", "difficulty")) as number;
    const level = calculateLevel({ difficulty, xp });

    if (target.nickname) serverInfo.push(`**${target.nickname}** in the server`);

    if (target.premiumSinceTimestamp)
      serverInfo.push(
        `Boosting since **${mention(target.premiumSinceTimestamp, "DEFAULT_TIMESTAMP")}**`,
      );

    if ((await getSetting(guild.id, "leveling", "enabled")) && !user.bot) {
      const leaderboard = (await getGuildLeaderboard(guild.id)).toSorted((a, b) => {
        return b.level == a.level ? b.xp - a.xp : b.level - a.level;
      });
      serverInfo.push(
        `Level **${level}** • ${xp && xp > 0 ? `**${xp.toLocaleString("en-US")}**/*${nextLevelXp.toLocaleString("en-US")} (level ${level + 1})* XP` : "**No** XP!"} ${
          leaderboard.some(entry => entry.userID == user.id)
            ? `• #**${leaderboard.findIndex(entry => entry.userID == user.id) + 1}** on the leaderboard`
            : ""
        }`,
      );
    }

    if (memberRoles.length > 0)
      serverInfo.push(
        `**${guildRoles.filter(role => target.roles.cache.has(role.id)).size - 1}** ${pluralOrNot(
          "role",
          memberRoles.length,
        )} • ${memberRoles
          .slice(0, 3)
          .map(role => mention(role[1].id, "ROLE"))
          .join(" • ")}${rolesLength > 3 ? ` and **${rolesLength - 3}** more` : ""}`,
      );
  }

  const container = new ContainerBuilder().setAccentColor(
    await colorize({ user, avatar, hue: Sokolors.Blue }),
  );

  if (banner)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)),
    );

  const createdText = [
    `<:discord:${replace("(discord)")}> ${mention(user.createdAt.valueOf(), "DEFAULT_TIMESTAMP")}`,
    (await safeMembers(guild)).has(user.id)
      ? `• ${mention((await safeMember(guild, user.id)).joinedAt?.valueOf() ?? 0, "DEFAULT_TIMESTAMP")}`
      : "",
  ].join(" ");
  const start = new TextDisplayBuilder().setContent(
    [`## ${name}`, `@${user.username}`, "**Member since**", createdText].join("\n"),
  );

  if (avatar)
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(start)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );
  else container.addTextDisplayComponents(start);

  if (serverInfo)
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(serverInfo.join("\n")));

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# User ID: ${user.id}`));
  await interaction.reply({ components: [container], flags: ["IsComponentsV2"] });
}
