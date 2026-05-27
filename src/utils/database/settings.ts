import { type InteractionResponse, type Message, PermissionFlagsBits } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { easterEggNames, eventNames } from "handlers/events";
import { client } from "src/bot";
import { dekominator } from "utils/kominator";
import { safeMember } from "utils/safeThings";
import type { Satisfies } from "utils/types";
import { db, values } from ".";
import type {
  FieldData,
  SettingPrecondition,
  SettingsDefinition,
  SqlType,
  TableDefinition,
  TypeOfDefinition,
} from "./types";

type Def = Satisfies<
  TableDefinition,
  {
    name: "settings";
    definition: {
      guildID: "TEXT";
      key: "TEXT";
      value: "TEXT";
    };
  }
>;

export type SettingSettableValue = string | string[] | boolean | number | null;

const invitePrecondition: SettingPrecondition<"BOOL" | "CHANNEL"> = async (
  interaction,
  newValue,
) => {
  if (
    newValue &&
    interaction.guild &&
    !(await safeMember(interaction.guild, interaction.client.user.id)).permissions.has(
      PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.ManageGuild,
    )
  )
    return `The **Create Invite** and the **Manage Server** permissions are required for this setting to work.`;
};

// for the [TODO]s below, remove the SettingsDefinition type and
// enjoy 26 type errors! :D
//
// idea: we could possibly remove "settings" and put all settings on the same level as description, just remove the description if you want to get only the settings
export const settingsDefinition: SettingsDefinition = {
  leveling: {
    description: "Customize the behavior of the leveling system.",
    settings: {
      enabled: {
        type: "BOOL",
        desc: "Enable/disable the leveling system.",
        val: true,
        emoji: "✅",
      },
      channel: {
        type: "CHANNEL",
        desc: "Channel for logging leveling-related stuff (i.e someone leveling up).",
        emoji: "📝",
      },
      block_channels: {
        type: "CHANNEL",
        desc: "Channels where messages aren't counted.",
        iterable: true,
        emoji: "🚫",
      },
      xp_gain: {
        type: "INTEGER",
        desc: "Set the amount of XP a user gains per message.",
        val: 2,
        emoji: "📈",
      },
      cooldown: {
        type: "INTEGER",
        desc: "Set the cooldown between messages that add XP (in seconds).",
        val: 2,
        emoji: "⏱️",
      },
      difficulty: {
        type: "INTEGER",
        desc: "Set the difficulty (ex: 2 will make it 2x harder to level up).",
        val: 1,
        emoji: "🧩",
      },
      rewards: {
        type: "OBJECT",
        desc: "Set roles and channels to be granted to users who reach specific levels.",
        iterable: true,
        emoji: "🌟",
        settings: {
          level: {
            type: "INTEGER",
            desc: "The level required to get the level reward.",
          },
          reward: {
            type: "REWARD",
            desc: "The reward that the user gets after reaching the aforementioned level.",
          },
        },
      },
    },
  },
  moderation: {
    description: "Change Sokora's settings related to moderation.",
    settings: {
      events: {
        type: "SELECT",
        desc: "Select what events you want to see in your log channel.",
        iterable: true,
        choices: eventNames,
        emoji: "📅",
      },
      channel: {
        type: "CHANNEL",
        desc: "Channel for logging moderation events.",
        emoji: "📋",
      },
      silent: {
        type: "BOOL",
        desc: "If enabled, all moderation actions will be done without pinging the affected user.",
        val: false,
        emoji: "🔇",
      },
    },
  },
  news: {
    description: "Configure news for your server.",
    settings: {
      channel: {
        type: "CHANNEL",
        desc: "Channel where news messages are sent.",
        emoji: "📰",
      },
      role: {
        type: "ROLE",
        desc: "Roles that should be pinged when a news message is sent.",
        iterable: true,
        emoji: "📢",
      },
      edit_original_message: {
        type: "BOOL",
        desc: "Whether or not the original message should be edited when a news message is updated.",
        val: true,
        emoji: "✏️",
      },
    },
  },
  starboard: {
    description: "Configure the starboard system.",
    settings: {
      enabled: {
        type: "BOOL",
        desc: "Enable/disable the starboard.",
        val: false,
        emoji: "✅",
      },
      channel: {
        type: "CHANNEL",
        desc: "Channel where starred messages appear.",
        emoji: "📌",
      },
      emoji: {
        type: "TEXT",
        desc: "Emoji used for starring messages.",
        val: "⭐",
        emoji: "⭐",
      },
      threshold: {
        type: "INTEGER",
        desc: "Reactions needed for a message to be starred.",
        val: 3,
        emoji: "🦾",
      },
    },
  },
  serverboard: {
    description: "Configure your server's appearance on the serverboard.",
    settings: {
      shown: {
        type: "BOOL",
        desc: "Whether or not the server should be shown on the serverboard.",
        val: false,
        emoji: "🌐",
      },
      server_invite: {
        type: "BOOL",
        desc: "Whether to show a server invite link on the serverboard page.",
        val: false,
        precondition: invitePrecondition,
        emoji: "🔗",
      },
      invite_channel: {
        type: "CHANNEL",
        desc: "Channel for the invite. If not set, uses the first channel in the channel list.",
        // precondition: invitePrecondition,
        emoji: "📨",
      },
    },
  },
  welcome: {
    description: "Change how Sokora welcomes your new users.",
    settings: {
      join_channel: {
        type: "CHANNEL",
        desc: "Channel where welcome messages are sent.",
        emoji: "📥",
      },
      join_text: {
        type: "TEXT",
        desc: "Text sent when a user joins. Use (variables) to add dynamic info, run /help variables for info.",
        val: "Welcome to (servername), (name)! Interestingly, you just helped us reach (count) members. Have a nice day!",
        emoji: "👋",
      },
      leave_channel: {
        type: "CHANNEL",
        desc: "Channel where leave messages are sent.",
        emoji: "📤",
      },
      leave_text: {
        type: "TEXT",
        desc: "Text sent when a user leaves. Use (variables) to add dynamic info, run /help variables for info.",
        val: "(name) has left the server! 😥",
        emoji: "🚪",
      },
      join_dm: {
        type: "BOOL",
        desc: "Whether or not the bot should send a custom DM message to the user upon joining.",
        val: false,
        emoji: "💌",
      },
      dm_text: {
        type: "TEXT",
        desc: "Text sent in the user's DM when they join the server. Use (variables) to add dynamic info, run /help variables for info.",
        val: "Welcome to (servername), (name)! Interestingly, you just helped us reach (count) members. Have a nice day!",
        emoji: "📬",
      },
      roles: {
        type: "ROLE",
        desc: "The roles that should be given to the user when they join.",
        iterable: true,
        emoji: "🎭",
      },
    },
  },
  easter: {
    description: "Enable/disable easter eggs.",
    settings: {
      enabled: {
        type: "BOOL",
        desc: 'Whether or not the bot should reply to certain messages with "easter egg" messages.',
        val: false,
        emoji: "✅",
      },
      enabled_eggs: {
        type: "SELECT",
        desc: "Specific easter eggs to enable. If none are selected, all easter eggs are enabled.",
        iterable: true,
        choices: easterEggNames,
        emoji: "🐣",
      },
      allowed_channels: {
        type: "CHANNEL",
        desc: "Channels where easter eggs are allowed.",
        iterable: true,
        emoji: "💬",
      },
    },
  },
};

export const settingsKeys = Object.keys(settingsDefinition);

const deleteQuery = async (guildID: string, key: string, sql_: Bun.SQL = db): Promise<Bun.SQL> =>
  await sql_`DELETE FROM settings WHERE "guildID" = ${guildID} AND "key" = ${key};`;

// [TODO] autocomplete support for get/setSetting
// [TODO] proper type validation for get/setSetting
export async function getSetting<
  K extends keyof typeof settingsDefinition,
  S extends keyof (typeof settingsDefinition)[K]["settings"],
>(
  guildID: string,
  key: K,
  setting: S,
): Promise<
  | SqlType<(typeof settingsDefinition)[K]["settings"][S]["type"]>
  | SqlType<(typeof settingsDefinition)[K]["settings"][S]["type"]>[]
  | null
  | undefined
> {
  if (!settingsDefinition[key]?.settings[setting]) {
    await errorEmbed({
      client,
      title: `Setting ${key}.${setting} does not exist in the database. Guild: ${guildID}.`,
      log: true,
      forward: true,
      fileName: "database/settings.ts",
    });
    return null;
  }

  const res = values<TypeOfDefinition<Def>>(
    await db`SELECT * FROM settings WHERE "guildID" = ${guildID} AND "key" = ${`${key}.${setting}`};`,
  );

  const set = settingsDefinition[key].settings[setting];
  if (res.length === 0) {
    if (!set) return null;
    return set.val as SqlType<(typeof settingsDefinition)[K]["settings"][S]["type"]>;
  }

  const value: string | string[] = res[0].value;
  if (!value || (typeof value == "string" && value == "null"))
    return set.val as SqlType<(typeof settingsDefinition)[K]["settings"][S]["type"]>;

  function switchTypes(value: string): SqlType<typeof set.type>[] | SqlType<typeof set.type> {
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

  // TODO: here value should be "string[]" but somehow is "string & any[]" if you remove the type cast
  if (Array.isArray(value))
    return (value as string[]).map(valuelet => switchTypes(valuelet)) as
      | SqlType<FieldData>
      | SqlType<FieldData>[];

  return switchTypes(value);
}

export async function getSettingCategory(
  guildID: string,
  key: keyof typeof settingsDefinition,
): Promise<Awaited<ReturnType<typeof getSetting>>[]> {
  const array: Awaited<ReturnType<typeof getSetting>>[] = [];
  for (const setting of Object.keys(settingsDefinition[key].settings))
    array.push(await getSetting(guildID, key, setting)); // We should be doing one query on the category instead and then check results against defaults

  return array;
}

export async function setSetting<K extends keyof typeof settingsDefinition>(
  guildID: string,
  key: K,
  setting: keyof (typeof settingsDefinition)[K]["settings"],
  value: SettingSettableValue,
): Promise<void> {
  const set = Array.isArray(value) ? dekominator(value) : value;
  const keySetting = `${key}.${setting}`;
  await db.begin(async tx => {
    // Two queries for one thing ? We could shorten it if we ever go with one DB ("on duplicate, update" kind of thing)
    await deleteQuery(guildID, keySetting, tx);
    await tx`INSERT INTO settings ("guildID", "key", "value") VALUES (${guildID}, ${keySetting}, ${set});`;
  }); // Autocommits if nothing goes wrong
}

export async function resetSetting<K extends keyof typeof settingsDefinition>(
  guildID: string,
  key: K,
  setting: keyof (typeof settingsDefinition)[K]["settings"],
): Promise<void> {
  await deleteQuery(guildID, `${key}.${setting}`);
}

export async function resetSettingCategory(
  guildID: string,
  key: keyof typeof settingsDefinition,
): Promise<void> {
  await db`DELETE FROM settings WHERE "guildID" = ${guildID} AND "key" LIKE ${`${key}%`};`;
}

export async function listPublicServers(): Promise<
  {
    guildID: string;
    showInvite: boolean;
    inviteChannelId: string | null;
  }[]
> {
  const publicGuildSet = new Set(
    values<TypeOfDefinition<Def>>(
      await db`SELECT * FROM settings WHERE "key" = 'serverboard.shown' AND "value" = 'true';`,
    ).map(entry => entry.guildID),
  );

  const inviteGuildsSet = new Set(
    values<TypeOfDefinition<Def>>(
      await db`SELECT * FROM settings WHERE "key" = 'serverboard.server_invite' AND "value" = 'true';`,
    ).map(entry => entry.guildID),
  );

  return Promise.all(
    [...publicGuildSet].map(async (entry: unknown) => {
      if (typeof entry != "string")
        throw new Error(`Somehow '${entry}' was not of type string in listPublicServers.`);
      const inviteChannel = await getSetting(entry, "serverboard", "invite_channel");
      return {
        guildID: entry,
        showInvite: inviteGuildsSet.has(entry),
        inviteChannelId: inviteChannel ? inviteChannel.toString() : null,
      };
    }),
  );
}

export async function deletePublicServer(
  guildID: string,
): Promise<Message | InteractionResponse | undefined> {
  try {
    await db`DELETE FROM settings WHERE "guildID" = ${guildID} AND "key" = 'serverboard.shown' AND "value" = 'true';`;
  } catch (error) {
    return await errorEmbed({
      client,
      error,
      log: true,
      forward: true,
      fileName: "database/settings.ts",
    });
  }
}
