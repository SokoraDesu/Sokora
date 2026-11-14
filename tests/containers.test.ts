import { beforeAll, describe, expect, test, setSystemTime } from "bun:test";
import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from "discord.js";
import { buildModEmbed } from "embeds/modEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { setup, state } from "./utilities";
import type { ModEmbedOptions } from "types";
import { mention } from "utils/mention";

beforeAll(async () => {
  await setup();

  setSystemTime(
    Temporal.Now.instant().add({
      minutes: 15,
    }).epochMilliseconds,
  );
});

describe("serverEmbed", () => {
  test.todo("modEmbed", async () => {
    // TODO: doesn’t fully work yet, because e.g. colorize() randomness
    const { guild, moderator, target } = state;

    const testCaseOne = {
      guild,
      moderator,
      action: "WARN",
      target,
      error: null,
      caseId: 55,
      title: "Warned someone",
      reason: "They were mean",
      isSilent: false,
    } satisfies ModEmbedOptions;

    const expected = new ContainerBuilder()
      .setAccentColor(await colorize({ hue: Sokolors.Green }))
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents([
            new TextDisplayBuilder().setContent(`**Warned ${mention(target.id, "USER")}  •  #55**`),
            new TextDisplayBuilder().setContent(
              [`**Moderator**: ${moderator.displayName}`, `**Reason**: ${testCaseOne.reason}`].join(
                "\n",
              ),
            ),
            new TextDisplayBuilder().setContent(
              `-# User ID: ${target.id} • ${mention(Date.now(), "DEFAULT_TIMESTAMP")}`,
            ),
          ])
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL())),
      );

    const embed = await buildModEmbed(testCaseOne);

    expect(embed).toStrictEqual(expected);
  });
});
