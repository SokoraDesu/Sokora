import { beforeAll, describe, expect, test } from "bun:test";
import { MILLISEC_30M, TESTER_CHANNEL } from "utils/constants";
import { warn } from "features/mod/warn";
import { getCase } from "database/moderation";
import { mute } from "features/mod/mute";
import { unmute } from "features/mod/unmute";
import { db } from "database/index";
import { expectFailure, expectFailureReason, expectSuccess, setup, state } from "./utilities";
import { slowdown } from "features/mod/slowdown";
import { safeChannel, safeMember, safeUser } from "utils/safeThings";
import { ban } from "features/mod/ban";
import { unban } from "features/mod/unban";

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
    expect(cases[0].target_id).toBe(target.id);
    expect(cases[0].moderator_id).toBe(moderator.id);
    expect(cases[0].type).toBe("WARN");

    const owner = await safeMember(guild, guild.ownerId);

    const failureOne = await warn({
      guild,
      moderator,
      target: owner.user,
      reason: "Coup d’état!",
      isSilent: false,
    });

    expectFailure(failureOne);
    expectFailureReason(failureOne).toBeBlamedOn("user");
    expectFailureReason(failureOne).toBeTitled(`You can’t warn ${owner.user.displayName}.`);
    expectFailureReason(failureOne).toBeJustified(
      "The member has a higher role position than you.",
    );
  });

  test("ban/unban feature works", async () => {
    const { guild, moderator } = state;
    const target = await safeUser(guild.client, "159985870458322944");

    try {
      await guild.members.unban(target.id, undefined);
    } catch {
      // heh
    }

    const result = await ban({
      guild,
      moderator,
      target,
      reason: "You deserve this from every server.",
      isSilent: false,
      durationMillisec: undefined,
      delMessageSeconds: undefined,
    });

    expectSuccess(result);

    // TODO: this kinda exposes how bad our DB code is…
    const cases = (await getCase(guild.id)).filter(c => c.type === "BAN");

    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].target_id).toBe(target.id);
    expect(cases[0].moderator_id).toBe(moderator.id);

    const bans = await guild.bans.fetch();
    expect(bans.get(target.id)).toBeTruthy();

    const owner = await safeMember(guild, guild.ownerId);

    const failureOne = await ban({
      guild,
      moderator,
      target: owner.user,
      reason: "Coup d’état!",
      isSilent: false,
      durationMillisec: undefined,
      delMessageSeconds: undefined,
    });

    expectFailure(failureOne);
    expectFailureReason(failureOne).toBeBlamedOn("user");
    expectFailureReason(failureOne).toBeTitled(`You can’t ban ${owner.user.displayName}.`);
    expectFailureReason(failureOne).toBeJustified(
      "The member has a higher role position than you.",
    );

    const unbanResult = await unban({
      guild,
      target,
      moderator,
      reason: "Sigh.",
      isSilent: false,
    });

    expectSuccess(unbanResult);

    const bansAgain = await guild.bans.fetch();
    expect(bansAgain.get(target.id)).toBeUndefined();
  });

  test.todo("kick feature works", async () => {
    // kick cannot be tested so far as, well, you can’t kick target because you need it elsewhere
    // TODO: figure out a way to test this, including error states
    // for now we can rely on human testers
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

    // NOTE: Discord latency has made tests fail a few times…
    // should wait a little on it
    await Bun.sleep(2000);

    expectSuccess(muteResult);

    const cases = await getCase(guild.id);
    expect(cases.length).toBeGreaterThan(0);

    const last = cases.pop();

    if (!last) throw new Error("No last case?");

    expect(last.target_id).toBe(target.id);
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

    expect(lastAgain.target_id).toBe(target.id);
    expect(lastAgain.moderator_id).toBe(moderator.id);
    expect(lastAgain.type).toBe("UNMUTE");

    const isStillMuted = tgtMember.isCommunicationDisabled();

    expect(isStillMuted).toBe(false);
  });

  test("slowdown feature works", async () => {
    const { guild, moderator } = state;

    if (!TESTER_CHANNEL) throw new Error("no tester_channel");
    const channel = await safeChannel(guild, TESTER_CHANNEL);
    if (!channel?.isTextBased() || channel.isDMBased()) throw new Error("No irl tester channel?");

    const TIME = 6000;

    const makeSlowResult = await slowdown({
      guild,
      moderator,
      reason: "Test slowdown",
      timeMillisec: TIME,
      channel,
    });

    expectSuccess(makeSlowResult);

    const cases = await getCase(guild.id);
    expect(cases.length).toBeGreaterThan(0);

    const last = cases.pop();

    if (!last) throw new Error("No last case?");

    expect(last.target_id).toBe(channel.id);
    expect(last.moderator_id).toBe(moderator.id);
    expect(last.type).toBe("SLOWDOWN");

    const slow = channel.rateLimitPerUser;

    expect(slow).toBe(TIME / 1000);

    const makeFastResult = await slowdown({
      guild,
      moderator,
      reason: "Test non-slowdown",
      timeMillisec: 0,
      channel,
    });

    expectSuccess(makeFastResult);

    const casesAgain = await getCase(guild.id);
    expect(casesAgain.length).toBeGreaterThan(cases.length);

    const lastAgain = casesAgain.pop();

    if (!lastAgain) throw new Error("No last case again?");

    expect(lastAgain.target_id).toBe(channel.id);
    expect(lastAgain.moderator_id).toBe(moderator.id);
    expect(lastAgain.type).toBe("SLOWDOWN");

    const stillSlow = channel.rateLimitPerUser;

    expect(stillSlow).toBe(0);
  });
});
