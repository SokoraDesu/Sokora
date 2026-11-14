import { type ActivityType, type ClientOptions, Partials } from "discord.js";
import packageJson from "../../package.json" with { type: "json" };

/* eslint-disable unicorn/consistent-boolean-name */
export const MILLISEC_15M = 900_000;
export const MILLISEC_30M = 1_800_000;
export const MILLISEC_1H = 3_600_000;
export const MILLISEC_6H = 21_600_000;
export const MILLISEC_12H = 43_200_000;
export const SECONDS_7D = 604_800;
export const MILLISEC_28D = 2_419_200_000;

/**
240 000 milliseconds
*/
export const COLLECTOR_DURATION = 240_000;

export const MAX_INPUT_CHARS = 3600;

export const BOT_VERSION = packageJson.version;

export const MADE_WITH_EMOJI = (): string[] => {
  return Math.round(Math.random() * 100) <= 5
    ? ["⌨️", "💻", "🖥️"]
    : ["💖", "💝", "💓", "💗", "💘", "💟", "💕", "💞"];
};

export const TOKEN = process.env.TOKEN;
export const TOPGG_TOKEN = process.env.TOPGG_TOKEN;
export const DATABASE_URL = process.env.DATABASE_URL;
export const ENABLE_MEDIA_FETCHING = process.env.ENABLE_MEDIA_FETCHING;

export const OWNER = process.env.OWNER ?? "725985503177867295";
export const IS_CANARY = process.env.CANARY === "true";
/** Channel to relay error embeds to. */
export const ERROR_CHANNEL_ID = process.env.ERROR_CHANNEL_ID;
/** Channel to relay reports to. */
export const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;

/** Token of your testing bot. */
export const TESTER_TOKEN = process.env.TESTER_TOKEN;
/** Token of the testing guild. */
export const DEV_GUILD_ID = process.env.DEVELOPMENT_GUILD_ID;
/** If `true`, in-bot test runner is enabled. */
export const DEV_IRL_TESTING_ENABLED = process.env.DEVELOPMENT_ENABLE_IRL_TEST_SUITE === "true";
/** Tester A’s ID. */
export const TESTER_USER_A = process.env.TESTER_USER_ID_A;
/** Tester B’s ID. */
export const TESTER_USER_B = process.env.TESTER_USER_ID_B;
/** Testing channel. */
export const TESTER_CHANNEL = process.env.TESTER_CHANNEL_ID;

export const CLIENT_PAYLOAD = (activityText: string, activityType: ActivityType): ClientOptions => {
  return {
    presence: {
      activities: [{ name: activityText, type: activityType }],
    },
    partials: [Partials.Message, Partials.Reaction, Partials.User],
    intents: [
      "DirectMessages",
      "Guilds",
      "GuildMembers",
      "GuildMessages",
      "GuildModeration",
      "GuildEmojisAndStickers",
      "GuildBans",
      "GuildMessageReactions",
      "MessageContent",
    ],
  };
};
