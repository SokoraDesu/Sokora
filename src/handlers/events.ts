import { type Client, type InteractionResponse, type Message } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { client } from "src/bot";

const events: { name: string; event: ReturnType<Client["on"]> }[] = [];
export const eventNames = ["messageUpdate", "messageDelete", "settings"];
export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = join(process.cwd(), "src", "events");
  for (const eventFile of readdirSync(eventsPath)) {
    if (!eventFile.endsWith(".ts")) continue;
    const eventName = eventFile.split(".ts")[0];
    const event = (
      (await import(pathToFileURL(join(eventsPath, eventFile)).toString())) as {
        // typing hack
        default: (_: unknown) => void;
      }
    ).default;
    events.push({ name: eventName, event: client.on(eventName, event) });
  }
}

interface EasterEgg {
  name: string;
  run: (message: Message) => Promise<void>;
}

export const easterEggs: EasterEgg[] = [];
export const easterEggNames: string[] = [];
export async function loadEasterEggs(): Promise<Message | InteractionResponse | undefined> {
  const eventsPath = join(process.cwd(), "src", "events", "easterEggs");
  for (const easterEggFile of readdirSync(eventsPath)) {
    if (!easterEggFile.endsWith(".ts")) continue;
    try {
      const easterEggName = easterEggFile.split(".")[0];
      const eggModule = (await import(
        pathToFileURL(join(eventsPath, easterEggFile)).toString()
      )) as { run: (message: Message) => Promise<void> };
      if (typeof eggModule.run == "function") {
        const easterEgg: EasterEgg = {
          name: easterEggName,
          run: eggModule.run,
        };

        easterEggs.push(easterEgg);
        easterEggNames.push(easterEggName);
      }
    } catch (error) {
      return await errorEmbed({
        client,
        error,
        title: `Error loading easter egg ${easterEggFile}.`,
        log: true,
        forward: true,
        fileName: "events.ts",
      });
    }
  }
}
