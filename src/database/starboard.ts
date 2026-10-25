import { client } from "botfile";
import type { Satisfies } from "types";
import { db, values } from ".";
import type { TableDefinition, TypeOfDefinition } from "types";
import { errorEmbed } from "embeds/errorEmbed";

type Def = Satisfies<
  TableDefinition,
  {
    name: "starboard";
    definition: {
      guild_id: "TEXT";
      message_id: "TEXT";
      channel_id: "TEXT";
      author_id: "TEXT";
      star_message_id: "TEXT";
      stars: "INTEGER";
      timestamp: "TIMESTAMP";
    };
  }
>;

export async function getStarred(
  guildID: string,
  messageID: string,
): Promise<TypeOfDefinition<Def> | null> {
  const res = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM starboard WHERE "guild_id" = ${guildID} AND "message_id" = ${messageID};`,
  );
  return res.length === 0 ? null : res[0];
}

export async function setStarred(
  guildID: string,
  messageID: string,
  channelID: string,
  authorID: string,
  starMessageID: string,
  stars: number,
  timestamp: Date,
): Promise<void> {
  const insObject: TypeOfDefinition<Def> = {
    guild_id: guildID,
    message_id: messageID,
    channel_id: channelID,
    author_id: authorID,
    star_message_id: starMessageID,
    stars,
    timestamp,
  };
  await db.begin(async tx => {
    await tx`DELETE FROM starboard WHERE "guild_id" = ${guildID} AND "message_id" = ${messageID};`;
    await tx`INSERT INTO starboard ${db(insObject)};`;
  });
}

export async function deleteStarred(guildID: string, messageID: string): Promise<void> {
  try {
    await db`DELETE FROM starboard WHERE "guild_id" = ${guildID} AND "message_id" = ${messageID}`;
  } catch (error) {
    return await errorEmbed(true, {
      client,
      error,
      fileName: "database/starboard",
    });
  }
}
