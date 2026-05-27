import { errorEmbed } from "embeds/errorEmbed";
import { client } from "src/bot";
import { safeUser } from "utils/safeThings";
import type { Satisfies } from "utils/types";
import { db, values } from ".";
import type {
  SettingPrecondition,
  SettingsDefinition,
  SqlType,
  TableDefinition,
  TypeOfDefinition,
} from "./types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "user_settings";
    definition: {
      userID: "TEXT";
      key: "TEXT";
      value: "TEXT";
    };
  }
>;

const topggPrecondition: SettingPrecondition<"BOOL"> = async (
  interaction,
  newValue,
): Promise<string | undefined> => {
  const dmChannel = await (await safeUser(interaction.client, interaction.user.id)).createDM();
  if (newValue && !dmChannel?.isSendable())
    return `Sokora cannot DM you. Enable DMs for Sokora or send it a message to get top.gg notifications.`;
};

export const settingsDefinition: SettingsDefinition = {
  topgg: {
    description: "Change settings about Top.gg.",
    settings: {
      remind: {
        type: "BOOL",
        desc: "Whether or not should the bot remind you when you can vote in Top.gg. **This setting will DM you.**",
        val: false,
        precondition: topggPrecondition,
        emoji: "⏰",
      },
    },
  },
};
// } as const satisfies SettingsDefinition;
// could be an entry point to fixing the 27 type errors related to autocomplete

export const settingsKeys = Object.keys(settingsDefinition);

const deleteQuery = async (userID: string, key: string, sql_: Bun.SQL = db): Promise<Bun.SQL> =>
  await sql_`DELETE FROM user_settings WHERE "userID" = ${userID} AND "key" = ${key};`;
export async function getUserSettingsTable<K extends keyof typeof settingsDefinition>(
  key: K,
  setting: keyof (typeof settingsDefinition)[K]["settings"],
): Promise<TypeOfDefinition<Def>[] | null> {
  if (!settingsDefinition[key]?.settings[setting]) {
    await errorEmbed({
      client,
      title: `Setting ${key}.${setting} does not exist in the database at all.`,
      log: true,
      forward: true,
      fileName: "database/userSettings.ts",
    });
    return null;
  }

  return values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM user_settings WHERE "key" = ${`${key}.${setting}`};`,
  );
}

export async function getUserSetting<
  K extends keyof typeof settingsDefinition,
  S extends keyof (typeof settingsDefinition)[K]["settings"],
>(
  userID: string,
  key: K,
  setting: S,
): Promise<SqlType<(typeof settingsDefinition)[K]["settings"][S]["type"]> | null> {
  if (!settingsDefinition[key]?.settings[setting]) {
    await errorEmbed({
      client,
      title: `Setting ${key}.${setting} does not exist in the database. User: ${userID}.`,
      log: true,
      forward: true,
      fileName: "database/userSettings.ts",
    });
    return null;
  }

  const result = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM user_settings WHERE "userID" = ${userID} AND "key" = ${`${key}.${setting}`};`,
  );

  const set = settingsDefinition[key].settings[setting];
  if (result.length === 0) {
    if (!set) return null;
    return set.val as SqlType<(typeof settingsDefinition)[K]["settings"][S]["type"]>;
  }

  const value = result[0].value;
  switch (set.type) {
    case "BOOL": {
      return value == "true";
    }
    case "INTEGER": {
      return Number.parseInt(value);
    }
    default: {
      return value;
    }
  }
}

export async function setUserSetting<K extends keyof typeof settingsDefinition>(
  userID: string,
  key: K,
  setting: keyof (typeof settingsDefinition)[K]["settings"],
  value: unknown,
): Promise<void> {
  const keySetting = `${key}.${setting}`;
  await db.begin(async tx => {
    await deleteQuery(userID, keySetting, tx);
    await tx`INSERT INTO user_settings ("userID", "key", "value") VALUES (${userID}, ${keySetting}, ${value});`;
  });
}

export async function resetUserSetting<K extends keyof typeof settingsDefinition>(
  userID: string,
  key: K,
  setting: keyof (typeof settingsDefinition)[K]["settings"],
): Promise<void> {
  await deleteQuery(userID, `${key}.${setting}`);
}
