import type { Satisfies } from "utils/types";
import { db, values } from ".";
import type { TableDefinition, TypeOfDefinition } from "./types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "starboard";
    definition: {
      guild: "TEXT";
      message: "TEXT";
      channel: "TEXT";
      author: "TEXT";
      star_message: "TEXT";
      stars: "INTEGER";
      content: "TEXT";
      timestamp: "TIMESTAMP";
    };
  }
>;

export async function getStarred(
  guildID: string,
  messageID: string,
): Promise<TypeOfDefinition<Def> | null> {
  const res = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM starboard WHERE "guild" = ${guildID} AND "message" = ${messageID};`,
  );
  if (res.length === 0) return null;
  return res[0];
}

export async function setStarred(
  guildID: string,
  messageID: string,
  channelID: string,
  authorID: string,
  starMessageID: string,
  stars: number,
  content: string,
  timestamp: Date,
): Promise<void> {
  const insObject = {
    guild: guildID,
    message: messageID,
    channel: channelID,
    author: authorID,
    star_message: starMessageID,
    stars,
    content,
    timestamp,
  };
  // [TODO] TypeError: Binding expected string, TypedArray, boolean, number, bigint or null
  await db.begin(async tx => {
    await tx`DELETE FROM starboard WHERE "guild" = ${guildID} AND "message" = ${messageID};`;
    await tx`INSERT INTO starboard ${db(insObject)};`;
  });
}
