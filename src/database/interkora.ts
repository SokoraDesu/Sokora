import { getSetting, setSetting } from "database/settings";
import { db } from "database/index";
import type { TableDefinition, TypeOfDefinition, Satisfies, PermissionTable } from "types";

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
      updated_at: "TIMESTAMP";
      token: "TEXT";
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

export async function setRegistration(
  entity_id: string,
  payload: RegisteredIntegration,
): Promise<void> {
  const TODO_OBVIOUSLY_AN_EXAMPLE_token = "1234";
  await db`INSERT INTO itk_registrations (payload, entity_id, token) VALUES (${entity_id}, ${db(payload)}, ${TODO_OBVIOUSLY_AN_EXAMPLE_token})`;
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
