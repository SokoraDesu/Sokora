import { ShardingManager } from "discord.js";
import { ENABLE_MEDIA_FETCHING, TOKEN } from "const";

const manager = new ShardingManager("./src/bot.ts", { token: TOKEN });
manager.on("shardCreate", shard => {
  shard.on("error", error => {
    console.error(error);
  });
  console.log(`Launched shard ${shard.id}!`);
  if (ENABLE_MEDIA_FETCHING == "true")
    console.warn("External media and <meta> tag fetching is enabled; tread lightly!");
});

await manager.spawn();
