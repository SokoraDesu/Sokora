import type { Satisfies } from "types";
import { db, values } from ".";
import { type defLeveling, getSetting, setSetting } from "./settings";
import type { SqlObjectType, TableDefinition, TypeOfDefinition } from "types";
import type { Guild } from "discord.js";
import {
  Leveler,
  type LevelRewards,
  type Supported,
  type UserLevels,
} from "@subetedesu/honlvlimport";
import { insertObject } from "utils/insObject";

type Def = Satisfies<
  TableDefinition,
  {
    name: "leveling";
    definition: {
      guild_id: "TEXT";
      user_id: "TEXT";
      xp: "INTEGER";
    };
  }
>;

const getQuery = async (
  guild: string | number,
  userID: string,
): Promise<TypeOfDefinition<Def>[]> => {
  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM leveling WHERE "guild_id" = ${guild} AND "user_id" = ${userID};`,
  );
};

export async function getUserXp(guildID: string, userID: string): Promise<number> {
  const res = await getQuery(guildID, userID);
  return res.length === 0 ? 0 : res[0].xp;
}

export async function setUserXp(payload: TypeOfDefinition<Def>): Promise<void> {
  await db.begin(async tx => {
    await tx`DELETE FROM leveling WHERE "guild_id" = ${payload.guild_id} AND "user_id" = ${payload.user_id};`;
    await insertObject<Def>("leveling", payload, tx);
  });
}

export async function getGuildLeaderboard(
  guildID: string,
): Promise<(TypeOfDefinition<Def> & { level: number })[]> {
  const xpData = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM leveling WHERE "guild_id" = ${guildID};`,
  );

  const difficulty = await getSetting(guildID, "leveling", "difficulty");
  return xpData.map(x => ({ ...x, level: calculateLevel({ xp: x.xp, difficulty }) }));
}

const formula = (difficulty: number, level: number): number =>
  difficulty * (20 * level ** 2 + 200 * level + 100);

export function calculateLevel(argument: { difficulty: number; xp: number }): number {
  const { difficulty, xp } = argument;
  let level = 0;
  let baseXp = 0;
  while (baseXp <= xp) {
    level++;
    baseXp = formula(difficulty, level + 1);
  }

  return level;
}

export async function getXpForNextLevel(guildID: string, userID: string): Promise<number> {
  const difficulty = await getSetting(guildID, "leveling", "difficulty");
  return formula(
    difficulty,
    calculateLevel({ difficulty, xp: await getUserXp(guildID, userID) }) + 1,
  );
}

type LevelReward = SqlObjectType<(typeof defLeveling)["rewards"]["properties"]>;
type LevelReward$Less = Omit<LevelReward, "$">;

export async function getLevelRewards(guildID: string): Promise<LevelReward[]> {
  const rewards = await getSetting(guildID, "leveling", "rewards");
  return rewards ?? [];
}

/**
 * Shorthand for adding level rewards to DB.
 * @param guildID
 * @param rewards Array of constructed reward objects, without GUID.
 */
export async function addLevelRewards(guildID: string, rewards: LevelReward$Less[]): Promise<void> {
  const content = await getLevelRewards(guildID);
  const properRewards: LevelReward[] = rewards.map(r => ({ $: Bun.randomUUIDv7(), ...r }));
  if (content.length === 0) {
    // :sob:
    await setSetting(guildID, "leveling", "rewards", properRewards);
    return;
  }

  await setSetting(guildID, "leveling", "rewards", [...content, ...properRewards]);
}

/**
 * Shorthand for deleting rewards from the DB.
 * @param guildID
 * @param rewards Array of constructed reward objects with GUID.
 */
export async function removeLevelRewards(guildID: string, rewards: LevelReward[]): Promise<void> {
  const content = await getLevelRewards(guildID);
  if (!content) return;
  const newRewards = [];
  for (const reward of content) if (rewards.every(r => r.$ != reward.$)) newRewards.push(reward);

  await setSetting(guildID, "leveling", "rewards", newRewards);
}

export function buildLeveler(
  guild: string,
  apiKey?: string,
  target?: keyof typeof Supported,
): Leveler {
  return new Leveler({
    guild,
    tatsu_api: apiKey && target === "TATSU" ? apiKey : undefined,
    lurkr_api: apiKey && target === "LURKR" ? apiKey : undefined,
    amari_api: apiKey && target === "AMARI" ? apiKey : undefined,
  });
}

/**
 * Given an imported XP dataset, applies it on top of the Sokora one.
 *
 * @param guild Guild to import for
 * @param levels Data to bring
 * @param behavior Merge or overwrite?
 * @returns Array of result strings for the embed
 */
export async function importLevels(
  guild: Guild,
  levels: UserLevels[],
  behavior: "merge" | "overwrite",
): Promise<string[]> {
  const res: string[] = [];

  const difficulty = await getSetting(guild.id, "leveling", "difficulty");

  for (const user of guild.members.cache) {
    if (user[1].user.bot) continue;
    const imported = levels.find(lev => lev.uid == user[1].id);
    if (!imported) {
      res.push(
        `${user[1].user.username} wasn’t imported (had no data saved in the imported dataset)`,
      );
      continue;
    }

    const previousXp = await getUserXp(guild.id, user[1].id);
    const newXp = (behavior == "merge" ? previousXp : 0) + imported.current_xp;
    await setUserXp({ guild_id: guild.id, user_id: user[1].id, xp: newXp });
    res.push(
      `${user[1].user.username} updated from ${previousXp} XP (level ${calculateLevel({ xp: previousXp, difficulty })}) to **XP ${newXp} (level ${calculateLevel({ xp: newXp, difficulty })})**.`,
    );
  }

  return res;
}

export async function importRewards(guild: Guild, rewards: LevelRewards[]): Promise<void> {
  await addLevelRewards(
    guild.id,
    rewards.map(v => {
      return {
        level: v.lvl,
        ...v,
      };
    }),
  );
}
