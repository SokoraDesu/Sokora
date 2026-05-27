import { getPendingBans, removeCase } from "database/moderation";
import { type Client, EmbedBuilder } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "./colorize";
import { dotCheck } from "./dotCheck";
import { logChannel } from "./logChannel";
import { safeGuild, safeMember } from "./safeThings";

// eslint-disable-next-line @typescript-eslint/require-await
export async function scheduleUnban(
  client: Client,
  guildID: string,
  userID: string,
  modID: string,
  delay: number,
): Promise<Map<string, Timer>> {
  const scheduledUnbans = new Map<string, Timer>();
  const key = `${guildID}-${userID}`;
  if (scheduledUnbans.has(key)) clearTimeout(scheduledUnbans.get(key));

  const timeout = setTimeout(
    async () => {
      try {
        const id = (await getPendingBans(Date.now())).find(ban => ban.userID == userID)?.id;
        if (id) await removeCase(guildID, id);
        scheduledUnbans.delete(key);
        const guild = await safeGuild(client, guildID);
        if (!guild) return;

        const user = (await guild.bans.fetch(userID)).user;
        if (!user)
          return await errorEmbed({
            client,
            title: `Failed to unban user ${userID} in guild ${guildID}.`,
            reason: "User not found in the guild's ban list's cache.",
            log: true,
            forward: true,
            fileName: "unbanScheduler.ts",
          });

        const moderator = await safeMember(guild, modID);
        if (!moderator)
          return await errorEmbed({
            client,
            title: `Failed to unban user ${userID} in guild ${guildID}.`,
            reason: "Moderator not found in the guild cache.",
            log: true,
            forward: true,
            fileName: "unbanScheduler.ts",
          });

        const avatar = user.displayAvatarURL();
        const embed = new EmbedBuilder()
          .setAuthor({
            name: `${dotCheck({ string: avatar, doubleSpace: true })}Unbanned ${user.displayName}`,
            iconURL: avatar,
          })
          .setDescription(
            [`**Moderator**: ${moderator.displayName}`, "*Temporary ban has expired*"].join("\n"),
          )
          .setFooter({ text: `User ID: ${user.id}` })
          .setColor(await colorize({ hue: Sokolors.Green }));

        await logChannel(guild, { embeds: [embed] });
        await guild.members.unban(userID, "Temporary ban has expired");
      } catch (error) {
        return await errorEmbed({
          client,
          error,
          title: `Failed to unban user ${userID} in guild ${guildID}.`,
          log: true,
          forward: true,
          fileName: "unbanScheduler.ts",
        });
      }
    },
    // this math.min exists because apparently "delay" may surpass the limit
    // by being bigger than a signed int32 in some cases
    Math.min(delay, 2_147_483_646),
  );

  return scheduledUnbans.set(key, timeout);
}

export async function rescheduleUnbans(client: Client): Promise<void> {
  const now = Date.now();
  for (const ban of await getPendingBans(now)) {
    if (!ban.expiresAt) continue;
    if (typeof ban.expiresAt != "number" || Number.isNaN(ban.expiresAt)) {
      await errorEmbed({
        client,
        title: `Invalid expiresAt value for ban: ${ban.expiresAt}.`,
        log: true,
        forward: true,
        fileName: "unbanScheduler.ts",
      });
      continue;
    }

    const delay = ban.expiresAt - now;
    await (delay > 0
      ? scheduleUnban(client, ban.guild, ban.userID, ban.moderator, delay)
      : removeCase(ban.guild, ban.id));
  }
}
