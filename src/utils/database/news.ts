import type { Satisfies } from "utils/types";
import { db, values } from ".";
import type { TableDefinition, TypeOfDefinition } from "./types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "news";
    definition: {
      guildID: "TEXT";
      title: "TEXT";
      body: "TEXT";
      author: "TEXT";
      authorPFP: "mTEXT";
      createdAt: "TIMESTAMP";
      updatedAt: "mTIMESTAMP";
      messageID: "TEXT";
      imageURL: "mTEXT";
      id: "INTEGER";
    };
  }
>;

const sendQuery = async (
  guildID: string,
  title: string,
  body: string,
  author: string,
  authorPFP: string | undefined,
  createdAt: Date,
  updatedAt: Date | null,
  messageID: string,
  imageURL: string | null | undefined,
  id: number,
  sql_: Bun.SQL = db, // what's this supposed to do?
): Promise<void> => {
  const insObject = {
    guildID,
    title,
    body,
    author,
    authorPFP,
    createdAt,
    updatedAt,
    messageID,
    imageURL,
    id,
  };
  await sql_`INSERT INTO news ${db(insObject)};`;
};

export const listAllNews = async (guildID: string): Promise<TypeOfDefinition<Def>[]> =>
  values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guildID" = ${guildID} ORDER BY "id" DESC;`,
  );

export const getLatestNews = async (guildID: string): Promise<TypeOfDefinition<Def>[]> =>
  values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guildID" = ${guildID} ORDER BY "id" DESC LIMIT 1;`,
  );

const deleteQuery = async (guildID: string, id: number, sql_: Bun.SQL = db): Promise<Bun.SQL> =>
  await sql_`DELETE FROM news WHERE "guildID" = ${guildID} AND "id" = ${id};`;

export async function postNews(
  guildID: string,
  title: string,
  body: string,
  author: string,
  authorPFP: string | undefined,
  messageID: string,
  imageURL: string | null | undefined,
  id: number,
): Promise<void> {
  await sendQuery(
    guildID,
    title,
    body,
    author,
    authorPFP,
    new Date(),
    null,
    messageID,
    imageURL,
    id,
  );
}

export async function getNews(guildID: string, id: number): Promise<TypeOfDefinition<Def> | null> {
  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM news WHERE "guildID" = ${guildID} AND "id" = ${id};`,
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
      lastElement.guildID,
      title ?? lastElement.title,
      body ?? lastElement.body,
      lastElement.author,
      lastElement.authorPFP,
      lastElement.createdAt,
      new Date(),
      messageID ?? lastElement.messageID,
      imageURL ?? lastElement.imageURL,
      id,
      tx,
    );
  });
}

export async function deleteNews(guildID: string, id: number): Promise<void> {
  await deleteQuery(guildID, id);
}
