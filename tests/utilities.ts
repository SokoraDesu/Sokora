/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable unicorn/no-top-level-assignment-in-function */
import { Client, ActivityType, type Guild, type User, type GuildMember } from "discord.js";
import { errorType } from "utils/errorType";
import {
  CLIENT_PAYLOAD,
  DEV_GUILD_ID,
  OWNER,
  TESTER_TOKEN,
  TESTER_USER_A,
  TESTER_USER_B,
} from "const";
import { as, type FeatureOutput } from "types";
import { safeMember } from "utils/safeThings";
import { expect } from "bun:test";

// TODO: replace in favor of dual-client fetching
export const mockGuild = as<Guild>({
  id: DEV_GUILD_ID,
  memberCount: 12 ** 2,
  name: "Kosora",
  ownerId: OWNER,
  members: {
    cache: {
      get: () => mockUser(),
    },
  },
});

interface MockUserConfig {
  admin: boolean;
}

// TODO: replace in favor of dual-client fetching
export function mockUser(_config?: MockUserConfig): User {
  const config: MockUserConfig = _config ?? {
    admin: false,
  };

  return as<User>({
    displayName: "John Sokora",
    username: "mrserge01",
    id: OWNER,
    displayAvatarURL: () =>
      "https://kde.org/stuff/clipart/logo/kde-logo-white-gray-rounded-128x128.png",
    permissions: {
      has: () => config.admin,
    },
  });
}

// cached promise and state to stop HMR from doing weirdness
// not my idea, i searched this up
// this should prevent HMR or re-running the tests
// from re-logging in or re-fetching, which Discord won’t love
// so far it works ;)

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const state: {
  client: Client;
  guild: Guild;
  moderator: User;
  target: User;
  modMember: GuildMember;
  tgtMember: GuildMember;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = {} as any;

let readyPromise: Promise<void> | undefined;

export function setup(): Promise<void> {
  if (readyPromise) return readyPromise;

  if (!TESTER_TOKEN) throw new Error("You need two bots for testing, not just one.");

  const client = new Client(CLIENT_PAYLOAD("Sokora’s test suite :D", ActivityType.Playing));

  state.client = client;

  readyPromise = new Promise<void>((resolve, reject) => {
    client.once("clientReady", async () => {
      try {
        console.log("Slava Ukraini!");
        console.log(`Logged in as ${client.user?.tag}`);

        if (!DEV_GUILD_ID || !TESTER_USER_A || !TESTER_USER_B)
          throw new Error("Required environment variables are not set");

        state.guild = await client.guilds.fetch(DEV_GUILD_ID);
        state.moderator = await client.users.fetch(TESTER_USER_A);
        state.target = await client.users.fetch(TESTER_USER_B);

        state.modMember = await safeMember(state.guild, TESTER_USER_A);
        state.tgtMember = await safeMember(state.guild, TESTER_USER_B);

        console.log(`Guild ID: ${state.guild.id}`);
        resolve();
      } catch (error) {
        reject(errorType(error));
      }
    });

    client.login(TESTER_TOKEN).catch(reject);
  });

  return readyPromise;
}

export const expectSuccess = (o: FeatureOutput<unknown>): void => {
  if (!o.success) console.error(o.out, o.reason);
  return expect(o.success).toBe(true);
};
