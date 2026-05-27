import type { Message } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  if (!/^\W*test\W*$/.test(message.content)) return;
  const result =
    Math.random() < 0.9 ? randomize(["Succeeded ✅", "Failed ❌"]) : "Failed successfully ❎";

  await message.reply(result);
}
