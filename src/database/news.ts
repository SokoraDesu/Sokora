import type { Satisfies } from "types";
import { db, values } from ".";
import type { TableDefinition, TypeOfDefinition } from "types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "news";
    definition: {
      guild_id: "TEXT";
      title: "TEXT";
      body: "TEXT";
      author_id: "TEXT";
      created_at: "TIMESTAMP";
      updated_at: "mTIMESTAMP";
      message_id: "TEXT";
      image_url: "mTEXT";
      id: "INTEGER";
      category_id: "mTEXT";
    };
  }
>;

// TODO: better figure out typing for database stuff
export type NewsPost = TypeOfDefinition<Def>;

const sendQuery = async (
  guild_id: string,
  title: string,
  body: string,
  author_id: string,
  created_at: Date,
  updated_at: Date | undefined,
  message_id: string,
  image_url: string | undefined,
  id: number,
  category_id: string | undefined,
  sql_: Bun.SQL = db, // what's this supposed to do?
): Promise<void> => {
  const insObject: TypeOfDefinition<Def> = {
    guild_id,
    title,
    body,
    author_id,
    created_at,
    updated_at,
    message_id,
    image_url,
    id,
    category_id,
  };
  await sql_`INSERT INTO news ${db(insObject)};`;
};

export const listAllNews = async (guildID: string): Promise<TypeOfDefinition<Def>[]> => {
  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guild_id" = ${guildID} ORDER BY "id" DESC;`,
  );
};

export const listAllNewsInCategory = async (
  guildID: string,
  categoryID: string,
): Promise<TypeOfDefinition<Def>[]> => {
  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guild_id" = ${guildID} AND "category_id" = ${categoryID} ORDER BY "id" DESC;`,
  );
};

export const getLatestNews = async (guildID: string): Promise<TypeOfDefinition<Def>[]> => {
  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guild_id" = ${guildID} ORDER BY "id" DESC LIMIT 1;`,
  );
};

const deleteQuery = async (guildID: string, id: number, sql_: Bun.SQL = db): Promise<Bun.SQL> =>
  await sql_`DELETE FROM news WHERE "guild_id" = ${guildID} AND "id" = ${id};`;

export async function postNews(
  guildID: string,
  title: string,
  body: string,
  author: string,
  messageID: string,
  imageURL: string | undefined,
  id: number,
  category_id: string | undefined,
): Promise<void> {
  await sendQuery(
    guildID,
    title,
    body,
    author,
    new Date(),
    undefined,
    messageID,
    imageURL,
    id,
    category_id,
  );
}

export async function getNews(guildID: string, id: number): Promise<TypeOfDefinition<Def> | null> {
  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guild_id" = ${guildID} AND "id" = ${id};`,
  )[0];
}

export async function updateNews(
  guildID: string,
  id: number,
  title?: string,
  body?: string,
  messageID?: string,
  imageURL?: string | null,
): Promise<void> {
  const lastElement = await getNews(guildID, id);
  if (!lastElement)
    throw new Error(
      `Trying to update news with ID ${id} on GUILD ${guildID} failed because getNews(guildID, id) somehow returned null`,
    );

  await db.begin(async tx => {
    await deleteQuery(guildID, id, tx);
    await sendQuery(
      lastElement.guild_id,
      title ?? lastElement.title,
      body ?? lastElement.body,
      lastElement.author_id,
      lastElement.created_at,
      new Date(),
      messageID ?? lastElement.message_id,
      imageURL ?? lastElement.image_url,
      id,
      lastElement.category_id,
      tx,
    );
  });
}

export async function deleteNews(guildID: string, id: number): Promise<void> {
  await deleteQuery(guildID, id);
}
