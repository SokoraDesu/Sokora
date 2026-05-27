import { Api } from "@top-gg/sdk";
import { Chart, registerables } from "chart.js";
import { updateDatabase } from "database/index";
import { getUserSettingsTable, setUserSetting } from "database/userSettings";
import { ActivityType, Client, Partials } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import ms from "enhanced-ms";
import { registerGuildCommands } from "handlers/commands";
import { loadEasterEggs, loadEvents } from "handlers/events";
import { safeUser } from "utils/safeThings";
import { rescheduleUnbans } from "utils/unbanScheduler";

export const client = new Client({
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

client.once("clientReady", async () => {
  const token = process.env.TOPGG_TOKEN;
  if (token)
    setInterval(async () => {
      const topgg = new Api(token);
      try {
        await topgg.postStats({ serverCount: (await client.guilds.fetch()).size });
        console.log("Posted statistics to top.gg!");
      } catch (error) {
        console.error(`Failed to start top.gg autoposter: ${error}`);
      }

      for (const user of new Set(
        (await getUserSettingsTable("topgg", "remind"))
          ?.filter(index => index.value == "1")
          .map(index => index.userID.replaceAll('"', "")),
      ))
        try {
          if (await topgg.hasVoted(user)) continue;

          const dmChannel = await (await safeUser(client, user)).createDM();
          if (!dmChannel?.isSendable()) continue;

          await dmChannel.send(
            "Reminder that **you can vote for Sokora** on [top.gg](https://top.gg/bot/873918300726394960/vote) - go vote!!",
          );
        } catch (error) {
          await errorEmbed({
            client,
            error,
            title: "top.gg reminding error.",
            log: true,
            forward: true,
            fileName: "bot.ts",
          });
          await setUserSetting(user, "topgg", "remind", false);
        }
    }, ms("6h"));

  await updateDatabase(); // Needs to be executed before anything else (since some things like rescheduleUnbans needs a DB in the first place)
  await Promise.all([
    loadEvents(client),
    loadEasterEggs(),
    registerGuildCommands(client),
    rescheduleUnbans(client),
  ]).then(() => {
    console.log(Math.random() < 0.002 ? "こんにちは! (konichi whats upppppppp)" : "ちーっす！");
  });

  // if you want to register/remove guild/global commands, replace registerGuildCommands() with:
  // removeGuildCommands(client)
  // removeGlobalCommands(client)
  // registerGlobalCommands(client)
  Chart.register(...registerables);
});

await client.login(process.env.TOKEN);
