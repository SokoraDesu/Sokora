import { SQL } from "bun";
import { createHash } from "node:crypto";
import fs from "node:fs";

if (!process.env.DATABASE_URL) throw new Error("No DATABASE_URL");

export const db = new SQL(process.env.DATABASE_URL);
const migrationsDirectory = "./migrations";
const preferredHashType = "sha1";

/**
 * Retrieves the ACTUAL values from a query result because PostgreSQL adds unwanted data at the end
 * @param queryResult The returned object from a bun SQL query without using .values()
 * @param singles If true when selecting only one column, returns an array of only the column values instead. Else, returns like normal
 * @returns An array containing the objects (or direct values if singles) of the query result
 */
export function values<T = Record<string, unknown>>(
  queryResult: Record<string, unknown>,
  singles?: boolean,
): T[] {
  const actualValues: Record<string, T>[] = Object.values(queryResult).filter(
    v => v !== null && typeof v === "object" && !Array.isArray(v),
  ) as Record<string, T>[];
  return (
    singles && actualValues.length > 0 && Object.values(actualValues[0]).length === 1
      ? actualValues.map(v => Object.values(v)[0])
      : actualValues
  ) as T[];
}

async function getHash(file: string, hashAlgo?: string): Promise<string> {
  const hash = createHash(hashAlgo ?? "sha256");
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on("data", data => hash.update(data));
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

const migrationFiles = fs
  .readdirSync(migrationsDirectory)
  .filter(f => f.endsWith(".sql"))
  .toSorted()
  .map(f => `${migrationsDirectory}/${f}`);

const migrationsEntries = await Promise.all(
  migrationFiles.map(async file => [await getHash(file, preferredHashType), file]),
);
const migrations = Object.fromEntries(migrationsEntries) as Record<string, string>;

const hashList = Object.keys(migrations);

async function applyMigrations(after?: string): Promise<void> {
  const fileList = hashList.slice(after ? hashList.indexOf(after) + 1 : 0).map(h => migrations[h]);
  console.log(`Applying ${fileList.length} migrations...`);
  for (const file of fileList)
    try {
      await db.file(file);
    } catch (error) {
      throw new Error(`Failed to apply '${file}'.`, { cause: error });
    }

  await db`UPDATE _info SET value = ${hashList.at(-1)} WHERE "key" = 'version';`;
  console.log("Database updated successfully");
}

export async function updateDatabase(): Promise<void> {
  try {
    const DBversion = values<string>(
      await db`SELECT value FROM _info WHERE "key" = 'version';`,
      true,
    )[0];
    if (!DBversion) throw new Error("No DBVersion was assigned."); // Goes into initializing the DB
    if (DBversion == hashList.at(-1)) {
      console.log("Database up-to-date");
      return;
    }
    console.log("Updating database...");
    await applyMigrations(DBversion);
  } catch {
    console.log("Initializing database...");
    await db`
      CREATE TABLE IF NOT EXISTS _info ("key" TEXT, "value" TEXT);
      INSERT INTO _info VALUES ('version', '');
    `.simple();
    await applyMigrations();
  }
}
