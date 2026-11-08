import { test, expect, beforeAll, describe } from "bun:test";
import { interkora, type InterkoraPayload, type InterkoraPayloadIssue } from "api/v1/index";
import { setup, state } from "./utilities";
import { setSetting } from "database/settings";
import { TESTER_CHANNEL } from "utils/constants";
import { buildPayloadFromMessage } from "api/v1/message";
import { PermissionGrants, PermissionOrigins } from "types";

beforeAll(async () => {
  await setup();

  await setSetting(state.guild.id, "interkora", "enabled", true);
  await setSetting(state.guild.id, "leveling", "enabled", false);
  await setSetting(state.guild.id, "leveling", "xp_gain", 60);
});

async function makeMessage<Correct extends boolean>(
  content: string,
): Promise<Correct extends true ? InterkoraPayload : InterkoraPayloadIssue> {
  if (!TESTER_CHANNEL) throw new Error("No tester_channel!");
  const channel = state.guild.channels.cache.get(TESTER_CHANNEL);
  if (!channel?.isSendable()) throw new Error("Not sendable!");
  const message = await channel.send({
    content,
  });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return buildPayloadFromMessage(message) as any;
}

describe("interkora settings module", () => {
  test("interkora getters work", async () => {
    const { client, guild } = state;

    if (!client?.user) throw new Error("state.client not initialized");

    const messages1 = await Promise.all([
      makeMessage<true>("soko$get settings leveling.enabled"),
      makeMessage<true>("soko$get settings interkora"),
      makeMessage<true>(
        "\n\n    soko$          get                     settings                leveling.enabled        \n\n",
      ),
      makeMessage<true>("soko$get settings leveling.enabled yaml"),
    ]);
    const out1 = await Promise.all(messages1.map(async m => interkora(m, client)));

    expect(out1).toEqual([
      {
        ok: true,
        getterOutput: [["json", "false"]],
        queryOutput: [],
        setterOutput: [],
        modderOutput: [],
      },
      {
        ok: true,
        getterOutput: [
          [
            "json",
            JSON.stringify({
              enabled: true,
              whitelist: [],
              webhook_whitelist: [],
            }),
          ],
        ],
        queryOutput: [],
        setterOutput: [],
        modderOutput: [],
      },
      {
        ok: true,
        getterOutput: [["json", "false"]],
        queryOutput: [],
        setterOutput: [],
        modderOutput: [],
      },
      {
        ok: true,
        getterOutput: [["yaml", "false"]],
        queryOutput: [],
        setterOutput: [],
        modderOutput: [],
      },
    ]);

    const out2 = await makeMessage<false>("soko$get settings leveling");

    expect(out2).toEqual({
      effectiveName: "Disabled",
      error: true,
      entity: {
        isEnabled: false,
        avatarURL: "",
        hasAdminPermission: true,
        permissionOrigin: PermissionOrigins.Admin,
        permissions: PermissionGrants.Everything,
        userId: client?.user?.id,
        whitelist: [],
        isWhitelisted: false,
        whitelistName: "whitelist",
      },
      effectiveStack: [`@msg#${client?.user?.id}`, "@Disabled"].join("\n"),
      gid: guild.id,
    });
  });
});
