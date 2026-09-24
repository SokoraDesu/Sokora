import type { Client, InteractionResponse, Message } from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { client } from "src/bot";

interface Event {
  name: string;
  event: ReturnType<Client["on"]>;
}

const events: Event[] = [];
export const eventNames = ["messageUpdate", "messageDelete", "settings"];
export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = path.join(process.cwd(), "src", "events");
  for (const eventFile of readdirSync(eventsPath)) {
    if (!eventFile.endsWith(".ts")) continue;
    const eventName = eventFile.split(".ts", 1)[0];
    const event = (
      (await import(pathToFileURL(path.join(eventsPath, eventFile)).toString())) as {
        // typing hack
        default: (_: unknown) => void;
      }
    ).default;
    events.push({
      name: eventName,
      event: client.on(eventName, async (...arguments_: unknown[]) =>
        handler(eventName, event, ...arguments_),
      ),
    });
    console.log("Loaded evt:", eventName);
  }
}

async function handler(
  fileName: string,
  function_: (..._: unknown[]) => void | Promise<void>,
  ...arguments_: unknown[]
): Promise<void> {
  try {
    await function_(...arguments_);
  } catch (error) {
    try {
      await errorEmbed({
        client,
        title: "Error while executing event",
        error,
        log: true,
        forward: true,
        fileName,
      });
    } catch (error_) {
      console.error("Failed to send error message");
      console.error(error_);
    }
  }
}

interface EasterEgg {
  name: string;
  run: (message: Message) => Promise<void>;
}

export const easterEggs: EasterEgg[] = [];
export const easterEggNames: string[] = [];
export async function loadEasterEggs(): Promise<Message | InteractionResponse | undefined> {
  const eventsPath = path.join(process.cwd(), "src", "events", "easterEggs");
  for (const easterEggFile of readdirSync(eventsPath)) {
    if (!easterEggFile.endsWith(".ts")) continue;
    try {
      const easterEggName = easterEggFile.split(".", 1)[0];
      const eggModule = (await import(
        pathToFileURL(path.join(eventsPath, easterEggFile)).toString()
      )) as { run: (message: Message) => Promise<void> };
      if (typeof eggModule.run == "function") {
        const easterEgg: EasterEgg = {
          name: easterEggName,
          run: eggModule.run,
        };

        easterEggs.push(easterEgg);
        easterEggNames.push(easterEggName);
        console.log("Loaded egg:", easterEggName);
      }
    } catch (error) {
      return await errorEmbed({
        client,
        error,
        title: `Error loading easter egg ${easterEggFile}.`,
        log: true,
        forward: true,
        fileName: "events",
      });
    }
  }
}
