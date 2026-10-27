import { beforeAll, describe, expect, test } from "bun:test";
import { MILLISEC_30M } from "utils/constants";
import { warn } from "features/mod/warn";
import { getCase } from "database/moderation";
import { mute } from "features/mod/mute";
import { unmute } from "features/mod/unmute";
import { db } from "database/index";
import { expectSuccess, setup, state } from "./utilities";

beforeAll(async () => {
  await setup();

  await db`DELETE FROM moderation WHERE "guild_id" = ${state.guild.id};`;
});

describe("moderation features", () => {
  test("warn feature works", async () => {
    const { guild, moderator, target } = state;

    const result = await warn({
      guild,
      moderator,
      target,
      reason: "Test warning",
      isSilent: false,
    });

    expectSuccess(result);

    const cases = await getCase(guild.id);

    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].user_id).toBe(target.id);
    expect(cases[0].moderator_id).toBe(moderator.id);
    expect(cases[0].type).toBe("WARN");
  });

  test("mute/unmute feature works", async () => {
    const { guild, moderator, target, tgtMember } = state;

    const muteResult = await mute({
      guild,
      moderator,
      target,
      reason: "Test mute",
      isSilent: false,
      durationMillisec: MILLISEC_30M,
    });

    expectSuccess(muteResult);

    const cases = await getCase(guild.id);
    expect(cases.length).toBeGreaterThan(0);

    const last = cases.pop();

    if (!last) throw new Error("No last case?");

    expect(last.user_id).toBe(target.id);
    expect(last.moderator_id).toBe(moderator.id);
    expect(last.type).toBe("MUTE");

    const isMuted = tgtMember.isCommunicationDisabled();

    expect(isMuted).toBe(true);

    const unmuteResult = await unmute({
      guild,
      moderator,
      target,
      reason: "Test unmute",
      isSilent: false,
    });

    expectSuccess(unmuteResult);

    const casesAgain = await getCase(guild.id);
    expect(casesAgain.length).toBeGreaterThan(cases.length);

    const lastAgain = casesAgain.pop();

    if (!lastAgain) throw new Error("No last case again?");

    expect(lastAgain.user_id).toBe(target.id);
    expect(lastAgain.moderator_id).toBe(moderator.id);
    expect(lastAgain.type).toBe("UNMUTE");

    const isStillMuted = tgtMember.isCommunicationDisabled();

    expect(isStillMuted).toBe(false);
  });
});
