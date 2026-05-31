import type { Message } from "discord.js";
import { randomize } from "utils/randomize";

export async function run(message: Message): Promise<void> {
  const message_ = message.content.trim().toLowerCase();
  if (!/what(?:'s| does)? .*sokora.*mean/.test(message_)) return;

  const chances = Number.parseFloat((Math.random() * 10).toFixed(3));
  const normalReplies = [
    "Sokora means 'everywhere' in japanese.",
    "'_Everywhere_', it means 'everywhere'. It's because we're everywhere you need us; whether it is moderating channels or keeping the server fun.",
    "We try to help on every server, on every matter, at every moment. Thus we named our bot 'Sokora', which stands for 'everywhere'.",
    "Well, Discord has a lot servers from different kinds, from gaming servers to coding servers to anime servers to political servers to whatever you can imagine. And we wanted _this_ to be everywhere, making everyone's server better. So _this_ was named 'everywhere' (in japanese, where **Sokora** is _everywhere_).",
  ];

  const rareReplies = [
    "idk bro ask google",
    "idk bro, not like that's my name or anything",
    "good question",
  ];

  const ultraRareReply = "# 'SOKORA' MEANS 'EVERYTHING' IN JAPANESE!!!!!!1";
  const reply =
    message.author.id == "823939421686071386" || chances < 0.3
      ? ultraRareReply
      : (chances >= 0.3 && chances < 3
        ? randomize(rareReplies)
        : randomize(normalReplies));

  await message.reply(reply);
}
