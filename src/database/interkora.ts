import { getSetting, setSetting } from "database/settings";
import { db, values } from "database/index";
import type { TableDefinition, TypeOfDefinition, Satisfies, PermissionTable } from "types";
import { insertObject } from "utils/insObject";

type RequestorsDef = Satisfies<
  TableDefinition,
  {
    name: "itk_requestors";
    definition: {
      guild_id: "TEXT";
      entity_id: "TEXT";
      entity_type: "TEXT";
      timestamp: "TIMESTAMP";
    };
  }
>;

type R = Omit<TypeOfDefinition<RequestorsDef>, "guildId" | "entityType">;

type RegistrationsDef = Satisfies<
  TableDefinition,
  {
    name: "itk_registrations";
    definition: {
      entity_id: "TEXT";
      payload: "OBJECT";
      created_at: "TIMESTAMP";
      updated_at: "mTIMESTAMP";
      token_hash: "TEXT";
      token_date: "TIMESTAMP";
    };
  }
>;

interface RegisteredIntegration {
  name: string;
  description: string;
  type: "webhook" | "bot" | "remote";
  requestedPermissions: PermissionTable;
}

interface Registration {
  payload: RegisteredIntegration;
  created_at: TypeOfDefinition<RegistrationsDef>["created_at"];
  updated_at: TypeOfDefinition<RegistrationsDef>["updated_at"];
}

export async function getRegistration(entity_id: string): Promise<Registration | undefined> {
  const res = await db<
    TypeOfDefinition<RegistrationsDef>[]
  >`SELECT "payload", "created_at", "updated_at" FROM itk_registrations WHERE "entity_id" = ${entity_id};`;
  return (res[0] ?? undefined) as unknown as Registration | undefined;
}

/**
 * Registers an integration to generate an HTTP token and a marketplace listing.
 *
 * @param entity_id - ID of the entity to register
 * @param payload - JSON payload
 * @returns The database result and the bearer token. **Show it only once.**
 */
export async function setRegistration(
  entity_id: string,
  payload: RegisteredIntegration,
): Promise<{
  result: TypeOfDefinition<RegistrationsDef>;
  token: string;
}> {
  const token = ((): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return `itk_${Buffer.from(bytes).toString("base64url")}`;
  })();

  const result: TypeOfDefinition<RegistrationsDef> = {
    payload: db(payload),
    entity_id,
    token_date: Temporal.Now.instant(),
    token_hash: new Bun.CryptoHasher("sha3-512").update(token).digest("base64url"),
    created_at: Temporal.Now.instant(),
    updated_at: undefined,
  };

  await insertObject<RegistrationsDef>("itk_registrations", result);
  return { result, token };
}

export async function addWhitelist(
  guildId: string,
  userId: string,
  targetList: "whitelist" | "webhook_whitelist",
): Promise<void> {
  const previous = await getSetting(guildId, "interkora", targetList);
  if (previous.includes(userId)) return;
  const next = [...previous, userId];
  await setSetting(guildId, "interkora", targetList, next);
}

export async function remWhitelist(
  guildId: string,
  userId: string,
  targetList: "whitelist" | "webhook_whitelist",
): Promise<void> {
  const previous = await getSetting(guildId, "interkora", targetList);
  if (!previous.includes(userId)) return;
  const next = previous.filter(index => index != userId);
  await setSetting(guildId, "interkora", targetList, next);
}

export async function getRequestors(guild_id: string, entity_type: "u" | "h"): Promise<R[]> {
  const res = await db<
    R[]
  >`SELECT "entity_id", "request_date" FROM itk_requestors WHERE "guildId" = ${guild_id} AND "entity_type" = ${entity_type};`;
  return res;
}

export async function addRequestor(
  guild_id: string,
  entity_id: string,
  entity_type: "u" | "h",
): Promise<void> {
  await db`INSERT INTO itk_requestors ("guild_id", "entity_id", "entity_type") VALUES (${guild_id}, ${entity_id}, ${entity_type});`;
}

export async function getIdByToken(token: string): Promise<string | undefined> {
  const found = await db<string>`SELECT entity_id FROM itk_registrations WHERE token = ${token};`;
  return found ?? undefined;
}

type HeldModerationDef = Satisfies<
  TableDefinition,
  {
    name: "itk_held_moderation";
    definition: {
      guild_id: "TEXT";
      entity_id: "TEXT";
      guid: "TEXT";
      action: "TEXT";
      timestamp: "TIMESTAMP";
      mod_payload: "OBJECT";
    };
  }
>;

export async function getHeldModeration(o: { guild_id: string; entity_id: string }): Promise<
  {
    timestamp: Temporal.Instant;
    mod_payload: unknown;
    guid: string;
  }[]
> {
  const found = values<{
    timestamp: Temporal.Instant;
    mod_payload: unknown;
    guid: string;
  }>(
    await db`SELECT timestamp, mod_payload, guid FROM itk_held_moderation WHERE guild_id = ${o.guild_id} AND entity_id = ${o.entity_id};`,
  );
  return found ?? [];
}

export async function addHeldModeration(o: TypeOfDefinition<HeldModerationDef>): Promise<void> {
  await insertObject("itk_held_moderation", o);
}

export async function delHeldModeration(guid: string): Promise<void> {
  await db`DELETE FROM itk_held_moderation WHERE guid = ${guid}`;
}
