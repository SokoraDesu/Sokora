import type { Message } from "discord.js";
import { randomize } from "utils/randomize";

function computeSlop(text: string): string[] | undefined {
  if (text.includes("slopkora"))
    return [
      "*Slopkora*? No we did not add genAI what are you talking about?",
      "i am not slop :pray:",
      "no we’re not selling our data to the US government, no slop in sokora.",
    ];

  if (text.includes("microsoft"))
    return ["Microslop*", "why are we talking about Micro**slop**", "microslop?"];

  if (text.includes("openai")) return ["OpenSlop*", "sam altman slop you mean"];

  return text.includes("microslop")
    ? ["https://klipy.com/gifs/microslop-my-beloved", "https://klipy.com/gifs/microsoft-microslop "]
    : undefined;
}

export async function run(message: Message): Promise<void> {
  const slop = computeSlop(message.content.toLowerCase());
  if (!slop) return;
  const result = randomize(slop);

  await message.reply(result);
}
