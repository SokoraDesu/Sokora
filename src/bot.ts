import { Api } from "@top-gg/sdk";
import { Chart, registerables } from "chart.js";
import { updateDatabase } from "database/index";
import { getSettingsTable, setSetting } from "database/settings";
import {
  ActivityType,
  Client,
  type ClientApplication,
  codeBlock,
  ContainerBuilder,
  Partials,
  TextDisplayBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { registerGuildCommands } from "handlers/commands";
import { loadEasterEggs, loadEvents } from "handlers/events";
import fs from "node:fs";
import pLimit from "p-limit";
import { colorize, Sokolors } from "utils/colorize";
import { IS_CANARY, MILLISEC_30M, MILLISEC_12H, TOKEN, TOPGG_TOKEN } from "const";
import { mention } from "utils/mention";
import { safeAlertChannel, safeUser } from "utils/safeThings";
import type { GHCommit } from "types";
import { rescheduleUnbans } from "utils/unbanScheduler";
import { server } from "api/v1/http";

export let client: Client<true>;

const LOG_FILE = "/app/logs/lifecycle.log";
const CANARY_MSG_BATCH_SIZE = 25;

function appendLog(event: string): void {
  try {
    fs.appendFileSync(LOG_FILE, `${Date.now()}\t${event}\n`);
  } catch (error) {
    console.error(`something happened writing lifecycle log: ${error}`);
  }
}

async function tailLog(): Promise<string[]> {
  return (await Bun.$`tail -n 2 ${LOG_FILE}`.text()).split("\n");
}

if (import.meta.main) {
  process.on("SIGTERM", () => {
    appendLog("died to a sigterm");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    appendLog("died to a sigint");
    process.exit(0);
  });

  process.on("exit", code => {
    appendLog(`died with status code ${code}`);
  });

  client = new Client({
    presence: {
      activities: [{ name: "your feedback!", type: ActivityType.Listening }],
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
  });

  const topggCommandHandler = async (app: ClientApplication): Promise<void> => {
    if (!TOPGG_TOKEN) throw new Error("No TOPGG_TOKEN but somehow top.gg handler got called.");

    const topgg = new Api(TOPGG_TOKEN);
    try {
      const commands = (await app.commands.fetch()).map(command => command.toJSON());
      await topgg.postCommands(commands);
      console.log("Posted commands to top.gg!");
    } catch (error) {
      console.error(`Failed to start top.gg auto-poster: ${error}`);
    }
  };

  const topggVoteHandler = async (): Promise<void> => {
    if (!TOPGG_TOKEN) throw new Error("No TOPGG_TOKEN but somehow top.gg handler got called.");

    const topgg = new Api(TOPGG_TOKEN);
    try {
      await topgg.postStats({ serverCount: (await client.guilds.fetch()).size });
      console.log("Posted statistics to top.gg!");
    } catch (error) {
      console.error(`Failed to start top.gg auto-poster: ${error}`);
    }

    const users = new Set(
      (await getSettingsTable("topgg", "remind"))
        ?.filter(index => index.value == "1")
        // YES THIS IS BAD, SORRY
        .map(index => (index as unknown as { userID: string }).userID.replaceAll('"', "")),
    );

    for (const user of users)
      try {
        if (await topgg.hasVoted(user)) continue;

        const dmChannel = await (await safeUser(client, user)).createDM();
        if (!dmChannel?.isSendable()) continue;

        await dmChannel.send(
          "Reminder that **you can vote for Sokora** on [top.gg](https://top.gg/bot/873918300726394960/vote) - go vote!!",
        );
      } catch (error) {
        await errorEmbed(true, {
          client,
          error,
          title: "top.gg reminding error.",
          fileName: "bot",
        });
        await setSetting(user, "topgg", "remind", false);
      }
  };

  const yellAtEveryoneThatCanaryUpdated = async (): Promise<void> => {
    const user = client.user;
    // second to last log should be date of the second to last shutdown
    const lastNLogLines = await tailLog();
    const lastShutdown = new Date(Number(lastNLogLines[0].split("\t", 1)[0]) - MILLISEC_30M);
    const response = await fetch(
      `https://api.github.com/repos/SokoraDesu/Sokora/commits?since=${lastShutdown.toISOString()}&until=${new Date().toISOString()}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );
    const _log = (await response.json()) as GHCommit[];
    const log = _log.filter(c => {
      return (
        !c.commit.message.startsWith("Merge pull request") &&
        !c.commit.message.startsWith("[merge]")
      );
    });
    const hasTooManyCommits = log.length > 6;
    const dump = log
      .slice(0, 6)
      .map(c => {
        return `${c.commit.message
          .trim()
          .split("\n")
          .map(s => `+ ${s}`)
          .join("\n")}\n^ by ${c.commit.author?.name} in \`${c.sha.slice(0, 8)}\`\n`;
      })
      .join("\n");

    const timestamp = mention(lastShutdown.valueOf(), "DEFAULT_TIMESTAMP");
    const limit = pLimit(CANARY_MSG_BATCH_SIZE);

    console.log(
      "Issuing canary alert to",
      client.guilds.cache.size,
      "guilds in batches of",
      CANARY_MSG_BATCH_SIZE,
    );

    await Promise.all(
      client.guilds.cache.map(async guild => {
        return limit(async () => {
          if (!user) return;
          const alertChannel = await safeAlertChannel(guild);
          const textDisplayComponents =
            log.length > 0
              ? [
                  new TextDisplayBuilder().setContent("## Sokora Canary pulled updates!"),
                  new TextDisplayBuilder().setContent(
                    "Hello! This restart brought changes. We don’t maintain a formal changelog for these quick patches, so here’s a developer commit log, messages should be clear enough.",
                  ),
                  new TextDisplayBuilder().setContent(codeBlock("diff", dump)),
                  new TextDisplayBuilder().setContent(
                    hasTooManyCommits
                      ? // eslint-disable-next-line unicorn/string-content
                        `There’s more commits that don’t fit in this message (total is ${log.length}), see the full log [at this link](https://github.com/SokoraDesu/Sokora/compare/${log.at(-1)?.sha}...dev) or compare latest \`dev\` to \`${log.at(-1)?.sha.slice(0, 8)}\`.\nFor reference, changes are counted from the second the bot started up until ${timestamp}.`
                      : "That’s about it.",
                  ),
                ]
              : [
                  new TextDisplayBuilder().setContent(
                    "## Sokora Canary restarted, though there’s nothing new",
                  ),
                  new TextDisplayBuilder().setContent(
                    [
                      `Hello! This restart brought no new updates. For reference, shutdown was logged at ${timestamp} + 30’, and no new commits exist since.`,
                      "We’ll hopefully have something new soon.",
                    ].join("\n"),
                  ),
                ];

          await alertChannel.send({
            components: [
              new ContainerBuilder()
                .addTextDisplayComponents(textDisplayComponents)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `**Enjoy testing, and thanks for using Sokora Canary!**\n-# Sent to ${mention(alertChannel.id, "CHANNEL")}. Want to use another channel? Head to \`/settings moderation\` and change the Channel setting.`,
                  ),
                )
                .setAccentColor(
                  await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Green }),
                ),
            ],
            flags: "IsComponentsV2",
          });
        });
      }),
    );
  };

  client.once("clientReady", async () => {
    if (!client.application) throw new Error("No client.application, somehow");

    if (TOPGG_TOKEN) {
      setInterval(topggVoteHandler, MILLISEC_12H);
      await topggCommandHandler(client.application);
    }

    // runs before yellAtEveryoneThatCanaryUpdated() to ensure the file exists
    appendLog("startup");

    // Needs to be executed before anything else (since some things like rescheduleUnbans needs a DB in the first place)
    await updateDatabase(process.argv.includes("force-db-reset"));
    await Promise.all([
      loadEvents(client),
      loadEasterEggs(),
      registerGuildCommands(client),
      rescheduleUnbans(client),
    ]).then(() => {
      console.log(
        Math.random() < 0.002
          ? "こんにちは! (konichi whats upppppppp)"
          : `ちーっす${IS_CANARY ? " Canary!" : "!"} • Running as ${client.user?.id}`,
      );
    });
    if (IS_CANARY) await yellAtEveryoneThatCanaryUpdated();

    // if you want to register/remove guild/global commands, replace registerGuildCommands() with:
    // removeGuildCommands(client)
    // removeGlobalCommands(client)
    // registerGlobalCommands(client)
    Chart.register(...registerables);
  });

  await client.login(TOKEN);

  const runningServer = server(client);

  console.log(runningServer.url.href);
}
