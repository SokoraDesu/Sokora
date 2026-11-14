import { describe, test, expect, afterEach, mock, spyOn } from "bun:test";
import { mockGuild, mockUser } from "./utilities";

import { replace, replaceVariables } from "utils/replace";
import { mention, unmention } from "utils/mention";
import { pluralOrNot } from "utils/pluralOrNot";
import { capitalize } from "utils/capitalize";
import { getChangelog } from "utils/changelog";
import { checkForS } from "utils/checkForS";
import { dotCheck } from "utils/dotCheck";
import { humanizeSettings, humanizeSettingType } from "utils/humanizeSettings";
import type { SingleSettingDefinition } from "types";
import { as } from "types";
import { dekominator, kominator } from "utils/kominator";
import { StateTracker } from "utils/stateMachine";

afterEach(() => {
  mock.restore();
});

describe("replace.ts works", () => {
  test("replace() works", () => {
    const testString = replace("Sokora test, (madeWith)");

    expect(testString).toStartWith("Sokora test, Made with ");
    expect(testString).toEndWith(" by the Sokora team");
    expect(testString).toMatch(/⌨️|💻|🖥️|💖|💝|💓|💗|💘|💟|💕|💞/);

    const testStringTwo = replace("Sonora test, (actuallyMadeWith) (this isn’t a replacement)", [
      {
        text: "(actuallyMadeWith)",
        replacement: "made with hate towards the TypeScript typing system.",
      },
      { text: "(a)", replacement: "b" },
      {
        text: "Sonora",
        replacement: "Sokora",
      },
    ]);

    expect(testStringTwo).toEqual(
      "Sokora test, made with hate towards the TypeScript typing system. (this isn’t a replacement)",
    );
  });

  test("replaceVariables() works", async () => {
    const now = Date.now();
    spyOn(Date, "now").mockReturnValue(now);

    const testString = await replaceVariables(
      "(servername) owned by (serverowner) has (count) people. The (currentdate, simple) (i.e. (currentdate), (currentdate, detailed) more specifically) (name) ((username)) joined us. Welcome!",
      mockGuild,
      mockUser(),
    );

    expect(testString).toEqual(
      `Kosora owned by John Sokora has 144 people. The ${mention(now, "SIMPLE_TIMESTAMP")} (i.e. ${mention(now, "DEFAULT_TIMESTAMP")}, ${mention(now, "DETAILED_TIMESTAMP")} more specifically) John Sokora (mrserge01) joined us. Welcome!`,
    );
  });
});

test("pluralOrNot() works", () => {
  expect(pluralOrNot("car", 1)).toEqual("car");
  expect(pluralOrNot("car", 2)).toEqual("cars");
  expect(pluralOrNot("car", 0)).toEqual("cars");
  expect(pluralOrNot("car", -1)).toEqual("car");
  expect(pluralOrNot("car", -2)).toEqual("cars");

  expect(pluralOrNot("berry", 1)).toEqual("berry");
  expect(pluralOrNot("berry", 2)).toEqual("berries");
  expect(pluralOrNot("berry", 0)).toEqual("berries");
  expect(pluralOrNot("berry", -1)).toEqual("berry");
  expect(pluralOrNot("berry", -2)).toEqual("berries");
});

describe("mention.ts works", () => {
  test("mention() works", () => {
    const now = Date.now();
    const result = Math.floor(now / 1000);

    expect(mention("123", "USER")).toEqual("<@123>");
    expect(mention("123", "ROLE")).toEqual("<@&123>");
    expect(mention("123", "CHANNEL")).toEqual("<#123>");

    expect(mention(now, "DEFAULT_TIMESTAMP")).toEqual(`<t:${result}:D>`);
    expect(mention(now, "SIMPLE_TIMESTAMP")).toEqual(`<t:${result}:d>`);
    expect(mention(now, "DETAILED_TIMESTAMP")).toEqual(`<t:${result}>`);
  });

  test("unmention() works", () => {
    const now = Date.now();
    const result = Math.floor(now / 1000);

    expect(unmention("<@123>")).toEqual({
      type: "USER",
      res: "123",
    });
    expect(unmention("<@&123>")).toEqual({
      type: "ROLE",
      res: "123",
    });
    expect(unmention("<#123>")).toEqual({
      type: "CHANNEL",
      res: "123",
    });

    expect(unmention(`<t:${result}:D>`)).toEqual({
      type: "TIMESTAMP",
      res: result.toString(),
    });
    expect(unmention(`<t:${result}:d>`)).toEqual({
      type: "TIMESTAMP",
      res: result.toString(),
    });
    expect(unmention(`<t:${result}>`)).toEqual({
      type: "TIMESTAMP",
      res: result.toString(),
    });

    expect(unmention("<@>")).toBeUndefined();
    expect(unmention("<t:>")).toBeUndefined();
  });
});

test("capitalize() works", () => {
  expect(capitalize("aA")).toEqual("AA");
  expect(capitalize("Aa")).toEqual("Aa");
});

test("getChangelog() works", () => {
  expect(getChangelog("0.2.0")).toEqual({
    ver: "0.2.0",
    codename: "Kaishi",
    isMinor: true,
    date: "24/12/2024",
    body: {
      Added: `- Commands
  - \`/changelog\`
  - \`/credits\`
  - \`/moderation notes\``.trim(),
      Changed: `- The bot will remove levels when an admin changed the leveling difficulty
- Now \`/leaderboard\` shows 6 users per page instead of 5
- When you add the bot, it sends a message in the system channel
- Remade the message logs
- Edit logs will let you jump to the message that got edited
- \`/settings\`
  - Autocompletes with channels/users/roles (you don’t have to copy IDs now :tada:)
  - In the embed it will show links to channels/users/roles instead of showing IDs
- \`/about\`
  - Vote button added
  - Moved credits into a different command to reduce the height of the embed`.trim(),
      Fixed: `- News
  - Major issue related to the database, where the guild wasn’t provided to ensure that news would be unique to every server, **thank you @Golem642!!!!**
  - \`/news\` edit’s modal errored when sending
- Moderation commands
  - \`/moderation clear\` removed one more message than the user provided
  - \`/moderation unban\` errored internally (it should send an error embed) when the user didn\\’t have the "Ban Members" permission
- Typos
  - warn mentions in \`/moderation warn\` are now warning to be more consistent
  - Removed old markdown remnants from \`/moderation slowdown\``,
    },
  });
});

test("checkForS() works", () => {
  expect(checkForS("Joseph")).toEqual("Joseph’s");
  expect(checkForS("Zakas")).toEqual("Zakas’");
  expect(checkForS("ZakaS")).toEqual("ZakaS’");
});

test.todo("colorize.ts works", () => {
  // (@MrSerge01)
  return;
});

test("dotCheck() works", () => {
  expect(
    dotCheck({
      string: "A",
      includeString: true,
    }),
  ).toEqual("A• ");
  expect(
    dotCheck({
      string: "A",
      includeString: true,
      doubleSpace: true,
    }),
  ).toEqual("A•  ");
  expect(
    dotCheck({
      string: "A",
      includeString: true,
      doubleSpace: true,
      twoSides: true,
    }),
  ).toEqual("A  •  ");
  expect(
    dotCheck({
      string: "A",
      includeString: true,
      twoSides: true,
    }),
  ).toEqual("A • ");
});

describe("humanizeSetting.ts works", () => {
  test("humanizeSettinType() works", () => {
    const generics = [
      "USER",
      "ROLE",
      "CHANNEL",
      "TEXT",
      "mTEXT",
      "TIMESTAMP",
      "mTIMESTAMP",
      "mCHANNEL",
      "mUSER",
      "mROLE",
      "OBJECT",
    ] as const;
    for (const t of generics)
      if (t.startsWith("m"))
        expect(
          humanizeSettingType(
            as<SingleSettingDefinition>({
              type: t,
            }),
          ),
        ).toEqual(t.toLowerCase() + " (optional)");
      else
        expect(
          humanizeSettingType(
            as<SingleSettingDefinition>({
              type: t,
            }),
          ),
        ).toEqual(t.toLowerCase());

    expect(
      humanizeSettingType(
        as<SingleSettingDefinition>({
          type: "BOOL",
        }),
      ),
    ).toEqual("boolean");
    expect(
      humanizeSettingType(
        as<SingleSettingDefinition>({
          type: "INTEGER",
        }),
      ),
    ).toEqual("number");
    expect(
      humanizeSettingType(
        as<SingleSettingDefinition>({
          type: "mINTEGER",
        }),
      ),
    ).toEqual("number (optional)");
  });

  test("humanizeSettings() works", () => {
    expect(humanizeSettings("enable_balls")).toEqual("Enable balls");
    expect(humanizeSettings("true")).toEqual("Enabled");
    expect(humanizeSettings("(servername)")).toEqual("`(servername)`");
    // etc…, same code, so it should work
  });
});

describe("kominator.ts works", () => {
  test("kominator() works", () => {
    expect(kominator("foo, bar, baz")).toEqual(["foo", "bar", "baz"]);
    expect(kominator("foo, bar, , baz")).toEqual(["foo", "bar", "baz"]);
  });

  test("dekominator() works", () => {
    expect(dekominator(["a", "b", "c"])).toEqual("a,b,c");
  });
});

describe("stateMachine.ts works", () => {
  test("initializes empty", () => {
    const tracker = new StateTracker<number>();

    expect(tracker.get("missing")).toBeUndefined();
    expect(tracker.exists("missing")).toBe(false);
  });

  test("sets and gets a value", () => {
    const tracker = new StateTracker<number>();

    expect(tracker.set("count", 42)).toBe(42);
    expect(tracker.get("count")).toBe(42);
    expect(tracker.exists("count")).toBe(true);
  });

  test("overwrites an existing value", () => {
    const tracker = new StateTracker<number>();

    tracker.set("count", 1);
    tracker.set("count", 2);

    expect(tracker.get("count")).toBe(2);
  });

  test("returns undefined when getting a missing key", () => {
    const tracker = new StateTracker<string>();

    expect(tracker.get("missing")).toBeUndefined();
  });

  test("updates an existing value", () => {
    const tracker = new StateTracker<number>();

    tracker.set("count", 10);

    const result = tracker.update("count", (previous = 0) => previous + 5);

    expect(result).toBe(15);
    expect(tracker.get("count")).toBe(15);
  });

  test("updates a missing value using undefined previous value", () => {
    const tracker = new StateTracker<number>();

    const callback = (previous: number | undefined): number => {
      expect(previous).toBeUndefined();
      return 10;
    };

    expect(tracker.update("count", callback)).toBe(10);
    expect(tracker.get("count")).toBe(10);
  });

  test("does not store a value when update callback returns undefined", () => {
    const tracker = new StateTracker<number>();

    tracker.set("count", 10);

    const result = tracker.update("count", () => {
      return;
    });

    expect(result).toBeUndefined();
    expect(tracker.get("count")).toBe(10);
  });

  test("does not store a value when update callback returns a falsy value", () => {
    const tracker = new StateTracker<number>();

    tracker.set("count", 10);

    expect(tracker.update("count", () => 0)).toBeUndefined();
    expect(tracker.get("count")).toBe(10);
  });

  test("does not create a value when update callback returns a falsy value", () => {
    const tracker = new StateTracker<number>();

    expect(tracker.update("count", () => 0)).toBeUndefined();
    expect(tracker.exists("count")).toBe(false);
  });

  test("delete removes an existing key", () => {
    const tracker = new StateTracker<string>();

    tracker.set("name", "Alice");

    expect(tracker.delete("name")).toBe(true);
    expect(tracker.get("name")).toBeUndefined();
    expect(tracker.exists("name")).toBe(false);
  });

  test("delete returns false for a missing key", () => {
    const tracker = new StateTracker<string>();

    expect(tracker.delete("missing")).toBe(false);
  });

  test("clear removes all values", () => {
    const tracker = new StateTracker<number>();

    tracker.set("a", 1);
    tracker.set("b", 2);
    tracker.set("c", 3);

    tracker.clear();

    expect(tracker.get("a")).toBeUndefined();
    expect(tracker.get("b")).toBeUndefined();
    expect(tracker.get("c")).toBeUndefined();
    expect(tracker.exists("a")).toBe(false);
    expect(tracker.exists("b")).toBe(false);
    expect(tracker.exists("c")).toBe(false);
  });

  test("supports multiple keys independently", () => {
    const tracker = new StateTracker<number>();

    tracker.set("a", 1);
    tracker.set("b", 2);

    tracker.update("a", (value = 0) => value + 10);

    expect(tracker.get("a")).toBe(11);
    expect(tracker.get("b")).toBe(2);
  });

  test("preserves object references", () => {
    const tracker = new StateTracker<{ count: number }>();
    const value = { count: 1 };

    expect(tracker.set("state", value)).toBe(value);
    expect(tracker.get("state")).toBe(value);
  });

  test("supports generic string values", () => {
    const tracker = new StateTracker<string>();

    tracker.set("status", "idle");

    expect(tracker.get("status")).toBe("idle");
    expect(tracker.update("status", previous => `${previous}-active`)).toBe("idle-active");
  });
});
