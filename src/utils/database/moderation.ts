import type { Satisfies } from "utils/types";
import { db, values } from ".";
import type { TableDefinition, TypeOfDefinition } from "./types";

export type Case = Satisfies<
  TableDefinition,
  {
    name: "moderation";
    definition: {
      guild: "TEXT";
      userID: "TEXT";
      type: "TEXT";
      moderator: "TEXT";
      reason: "TEXT";
      id: "INTEGER";
      timestamp: "TIMESTAMP";
      expiresAt: "TIMESTAMP";
    };
  }
>;

export type ModType = "MUTE" | "UNMUTE" | "WARN" | "KICK" | "BAN" | "UNBAN";

export async function createCase(
  guildID: string | number,
  userID: string,
  modType: ModType,
  moderator: string,
  reason = "",
  expiresAt?: Date | null,
): Promise<number> {
  const id: number =
    (values<number>(
      await db`SELECT id FROM moderation WHERE "guild" = ${guildID} ORDER BY "id" DESC LIMIT 1;`,
      true,
    )[0] ?? 0) + 1;

  const insObject = {
    guild: guildID,
    userID,
    type: modType,
    moderator,
    reason,
    id,
    timestamp: new Date(),
    expiresAt,
  };
  await db`INSERT INTO moderation ${db(insObject)};`; // Rare conflict possible if two mods add a case at the approx same moment ?
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
      WHERE "guild" = ${guildID}
      ${modType ? typeFilter : db``}
      ORDER BY "id" DESC;`,
  );
}

export async function listUserCases(
  guildID: number | string,
  userID: number | string,
  modType?: ModType,
): Promise<TypeOfDefinition<Case>[]> {
  const typeFilter = db`AND "type" = ${modType}`;
  return values<TypeOfDefinition<Case>>(
    await db`
      SELECT * FROM moderation
      WHERE "guild" = ${guildID}
      AND "userID" = ${userID}
      ${modType ? typeFilter : db``}
      ORDER BY "id" DESC;`,
  );
}

export async function getCase(
  guildID: number | string,
  id?: number,
): Promise<TypeOfDefinition<Case>[]> {
  const modCase = values<TypeOfDefinition<Case>>(
    await db`SELECT * FROM moderation WHERE "guild" = ${guildID} AND "id" = ${id};`,
  );

  if (modCase.length > 0) return modCase;
  return [];
}

export async function editCase(
  guildID: number | string,
  id: number,
  reason: string,
  expiresAt?: Date | null,
): Promise<void> {
  await db`UPDATE moderation SET reason = ${reason}, expiresAt = ${expiresAt} WHERE "guild" = ${guildID} AND "id" = ${id};`;
}

export async function removeCase(guildID: string | number, id: number): Promise<void> {
  await db`DELETE FROM moderation WHERE "guild" = ${guildID} AND id = ${id};`;
}

export async function getPendingBans(currentTime: number): Promise<TypeOfDefinition<Case>[]> {
  return values<TypeOfDefinition<Case>>(
    await db`SELECT * FROM moderation WHERE "type" = 'BAN' AND "expiresAt" IS NOT NULL AND "expiresAt" > ${new Date(currentTime)};`,
  );
}
