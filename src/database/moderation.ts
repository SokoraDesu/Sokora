import type { Channel, Guild, User } from "discord.js";
import { db, values } from ".";
import type { Satisfies, TableDefinition, TypeOfDefinition } from "types";
import { insertObject } from "utils/insObject";

export type Case = Satisfies<
  TableDefinition,
  {
    name: "moderation";
    definition: {
      guild_id: "TEXT";
      target_id: "TEXT";
      type: "TEXT";
      moderator_id: "TEXT";
      reason: "mTEXT";
      id: "INTEGER";
      timestamp: "TIMESTAMP";
      expires_at: "mTIMESTAMP";
    };
  }
>;

export type ModType =
  "MUTE" | "UNMUTE" | "WARN" | "KICK" | "BAN" | "UNBAN" | "LOCK" | "UNLOCK" | "SLOWDOWN" | "CLEAR";

export async function createCase(
  guild: Guild,
  target: Channel | User,
  modType: ModType,
  moderator: User,
  reason: string | null,
  expires_at?: Temporal.Instant,
): Promise<number> {
  const id: number =
    (values<number>(
      await db`SELECT id FROM moderation WHERE "guild_id" = ${guild.id} ORDER BY "id" DESC LIMIT 1;`,
      true,
    )[0] ?? 0) + 1;

  await insertObject<Case>("moderation", {
    guild_id: guild.id,
    target_id: target.id,
    type: modType,
    moderator_id: moderator.id,
    reason: reason ?? undefined,
    id,
    timestamp: Temporal.Now.instant(),
    expires_at,
  }); // Rare conflict possible if two mods add a case at the approx same moment ?
  return id;
}

export async function listGuildCases(
  guildID: number | string,
  modType?: ModType,
): Promise<TypeOfDefinition<Case>[]> {
  const typeFilter = db`AND "type" = ${modType}`;
  return values<TypeOfDefinition<Case>>(
    await db`
      SELECT * FROM moderation
      WHERE "guild_id" = ${guildID}
      ${modType ? typeFilter : db``}
      ORDER BY "id" DESC;`,
  );
}

// TODO: improve so it properly says it supports filtering by user or channel
export async function listUserCases(
  guildID: number | string,
  userID: number | string,
  modType?: ModType,
): Promise<TypeOfDefinition<Case>[]> {
  const typeFilter = db`AND "type" = ${modType}`;
  return values<TypeOfDefinition<Case>>(
    await db`
      SELECT * FROM moderation
      WHERE "guild_id" = ${guildID}
      AND "target_id" = ${userID}
      ${modType ? typeFilter : db``}
      ORDER BY "id" DESC;`,
  );
}

export async function getCase(
  guildID: number | string,
  id?: number,
): Promise<TypeOfDefinition<Case>[]> {
  return values<TypeOfDefinition<Case>>(
    id
      ? await db`SELECT * FROM moderation WHERE "guild_id" = ${guildID} AND "id" = ${id};`
      : await db`SELECT * FROM moderation WHERE "guild_id" = ${guildID}`,
  );
}

export async function editCase(
  guildID: number | string,
  id: number,
  reason: string,
  expiresAt?: Date | null,
): Promise<void> {
  await db`UPDATE moderation SET reason = ${reason}, expires_at = ${expiresAt} WHERE "guild_id" = ${guildID} AND "id" = ${id};`;
}

export async function removeCase(guildID: string | number, id: number): Promise<void> {
  await db`DELETE FROM moderation WHERE "guild_id" = ${guildID} AND id = ${id};`;
}

export async function getPendingBans(
  currentTimeMillisec?: number,
): Promise<TypeOfDefinition<Case>[]> {
  return values<TypeOfDefinition<Case>>(
    await db`SELECT * FROM moderation WHERE "type" = ${"BAN"} AND expires_at IS NOT NULL ${currentTimeMillisec ? db`AND expires_at > ${Temporal.Instant.fromEpochMilliseconds(currentTimeMillisec).toString()}` : db``} ORDER BY guild_id;`,
  );
}
