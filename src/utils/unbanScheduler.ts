import { createCase, getPendingBans } from "database/moderation";
import {
  type Client,
  ContainerBuilder,
  type Guild,
  TextDisplayBuilder,
  type User,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "./colorize";
import { logChannel } from "./logChannel";
import { safeGuild } from "./safeThings";
import { mention } from "./mention";
import { MILLISEC_1H } from "./constants";
import { client } from "botfile";

const scheduledUnbans = new Map<string, Timer>();

async function unbanUser(
  guild: Guild,
  target_id: string,
  moderator_id: string,
  caseId?: number,
): Promise<void> {
  let target: User;
  try {
    target = (await guild.bans.fetch(target_id)).user;
  } catch {
    return await errorEmbed(false, {
      client,
      title: `Failed to unban user ${target_id} in guild ${guild.id}.`,
      reason: "User not found in the guild’s ban list.",
      fileName: "unbanScheduler",
    });
  }

  caseId ??= (await getPendingBans(Date.now() - MILLISEC_1H)).find(
    ban => ban.user_id == target.id,
  )?.id;
  const unbanReason = `Temporary ban by <@${moderator_id}> has expired (cf. case ${caseId})`;
  // idk how can client.user be null but ok - @Golem642
  // client can be accessed before running Client#login(), in which case user IS null
  // anyways this was never the case so i fixed the type - @zakahacecosas
  await createCase(guild, target, "UNBAN", client.user, unbanReason);

  await guild.members.unban(target.id, unbanReason);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## Unbanned ${mention(target.id, "USER")}`),
      new TextDisplayBuilder().setContent(unbanReason),
      new TextDisplayBuilder().setContent(`-# User ID: ${target.id}`),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Green }));

  await logChannel(guild, { components: [container], flags: "IsComponentsV2" });
}

export function scheduleUnban(
  client: Client,
  guild: Guild,
  user_id: string,
  moderator_id: string,
  delay: number,
  caseId?: number,
): Map<string, Timer> {
  const key = `${guild.id}-${user_id}`;
  if (scheduledUnbans.has(key)) clearTimeout(scheduledUnbans.get(key));

  const timeout = setTimeout(
    async () => {
      try {
        await unbanUser(guild, user_id, moderator_id, caseId);
      } catch (error) {
        await errorEmbed(true, {
          client,
          error,
          title: `Failed to unban user ${user_id} in guild ${guild.id}.`,

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
  // hopefully a bot restart is faster than an hour lol, otherwise it might miss scheduled unbans
  const now = Date.now() - MILLISEC_1H;
  const bans = await getPendingBans(now);
  for (const ban of bans) {
    if (!ban.expires_at) continue;
    if (typeof ban.expires_at != "number" || Number.isNaN(ban.expires_at)) {
      await errorEmbed(true, {
        client,
        title: `Invalid expires_at value for ban: ${ban.expires_at}.`,

        fileName: "unbanScheduler",
      });
      continue;
    }

    try {
      const guildBan = await (await safeGuild(client, ban.guild_id)).bans.fetch(ban.user_id);
      console.log("Rescheduling", ban.id);
      const delay = ban.expires_at - now;
      if (delay > 0)
        scheduleUnban(client, guildBan.guild, ban.user_id, ban.moderator_id, delay, ban.id);
      else
        try {
          await unbanUser(guildBan.guild, ban.user_id, ban.moderator_id, ban.id);
        } catch (error) {
          await errorEmbed(true, {
            client,
            error,
            title: `Failed to unban user ${ban.user_id} in guild ${ban.guild_id}.`,

            fileName: "unbanScheduler",
          });
        }
    } catch {
      console.log("Unknown ban", ban.id);
    }
  }
  console.log("Rescheduled bans.");
}
