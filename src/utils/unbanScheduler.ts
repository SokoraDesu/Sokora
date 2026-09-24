import { getPendingBans, removeCase } from "database/moderation";
import {
  type Client,
  ContainerBuilder,
  type Guild,
  type InteractionResponse,
  type Message,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "./colorize";
import { logChannel } from "./logChannel";
import { safeGuild } from "./safeThings";
import { mention } from "./mention";

const scheduledUnbans = new Map<string, Timer>();

async function unbanUser(
  client: Client,
  guild: Guild,
  userID: string,
  caseId?: number,
): Promise<Message | InteractionResponse | undefined> {
  const guildID = guild.id;
  caseId ??= (await getPendingBans(Date.now() - 600)).find(ban => ban.userID == userID)?.id;
  if (caseId) await removeCase(guildID, caseId); // shouldn't we add an unban case instead ?

  const user = (await guild.bans.fetch(userID)).user;
  if (!user)
    return await errorEmbed({
      client,
      title: `Failed to unban user ${userID} in guild ${guildID}.`,
      reason: "User not found in the guild’s ban list.",
      log: true,
      forward: true,
      fileName: "unbanScheduler",
    });

  await guild.members.unban(userID, `Temporary ban has expired (cf. case ${caseId})`);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## Unbanned ${mention(user.id, "USER")}`),
      new TextDisplayBuilder().setContent(
        [
          `**Moderator**: ${client.user?.displayName ?? "Sokora"}`,
          `*Temporary ban has expired (cf. case ${caseId})*`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(`-# User ID: ${user.id}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Green }));

  await logChannel(guild, { components: [container], flags: "IsComponentsV2" });
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function scheduleUnban(
  client: Client,
  guild: Guild,
  userID: string,
  delay: number,
  caseId?: number,
): Promise<Map<string, Timer>> {
  const guildID = guild.id;
  const key = `${guildID}-${userID}`;
  if (scheduledUnbans.has(key)) clearTimeout(scheduledUnbans.get(key));

  const timeout = setTimeout(
    async () => {
      try {
        await unbanUser(client, guild, userID, caseId);
      } catch (error) {
        await errorEmbed({
          client,
          error,
          title: `Failed to unban user ${userID} in guild ${guildID}.`,
          log: true,
          forward: true,
          fileName: "unbanScheduler",
        });
      }
      scheduledUnbans.delete(key);
    },
    // this math.min exists because apparently "delay" may surpass the limit
    // by being bigger than a signed int32 in some cases
    Math.min(delay, 2_147_483_646),
  );

  return scheduledUnbans.set(key, timeout);
}

export async function rescheduleUnbans(client: Client): Promise<void> {
  const now = Date.now() - 600; // hopefully a bot restart is faster than 10mn, otherwise it might miss scheduled unbans
  const bans = await getPendingBans(now);
  for (const ban of bans) {
    if (!ban.expiresAt) continue;
    if (typeof ban.expiresAt != "number" || Number.isNaN(ban.expiresAt)) {
      await errorEmbed({
        client,
        title: `Invalid expiresAt value for ban: ${ban.expiresAt}.`,
        log: true,
        forward: true,
        fileName: "unbanScheduler",
      });
      continue;
    }

    try {
      const guildBan = await (await safeGuild(client, ban.guild)).bans.fetch(ban.userID);
      console.log("Rescheduling", ban.id);
      const delay = ban.expiresAt - now;
      if (delay > 0) await scheduleUnban(client, guildBan.guild, ban.userID, delay, ban.id);
      else
        try {
          await unbanUser(client, guildBan.guild, ban.userID, ban.id);
          await removeCase(ban.guild, ban.id);
        } catch (error) {
          await errorEmbed({
            client,
            error,
            title: `Failed to unban user ${ban.userID} in guild ${ban.guild}.`,
            log: true,
            forward: true,
            fileName: "unbanScheduler",
          });
        }
    } catch {
      console.log("Unknown ban", ban.id);
      await removeCase(ban.guild, ban.id);
    }
  }
  console.log("Rescheduled bans.");
}
