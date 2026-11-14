import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";

export const data = new SlashCommandSubcommandBuilder()
  .setName("import")
  .setDescription("Show help with how to import leveling data from other bots.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const firstContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## The /import command"),
      new TextDisplayBuilder().setContent(
        "You can use the `/import` command to bring your leaderboard from other bots into Sokora.",
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const botsContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 📜 • Supported bots"),
      new TextDisplayBuilder().setContent(
        [
          "- 🟢 • Tatsu • [tatsu.gg](https://tatsu.gg)",
          "🔵 • MEE6 • [mee6.xyz](https://mee6.xyz)",
          "🟠 • Lurkr • [lurkr.gg](https://lurkr.gg)",
          "🟡 • Amari • [amaribot.com](https://amaribot.com/)",
        ].join("\n- "),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const instructContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 👀 • What you need to do"),
      new TextDisplayBuilder().setContent(
        [
          "Sokora imports data using the bot provider’s API. This requires you to **make your leaderboard public** from the bot’s dashboard, for all bots. You also need an API key (except for MEE6), which for all bots is simply obtained with either a command (Tatsu), via request (Amari) or a web panel (Lurkr). For Lurkr this is a bit harder as you configure the token too (with read only permissions on your server’s leaderboard).\n",
          "Once ready, last thing to do is to choose between a 🟩 **data merge** or a 🟥 **data overwrite**.\n",
          "> 🟩 **Merging will ADD levels on top of Sokora’s existing leaderboard.**\n> ",
          "> For example, if member Goos has 200 XP with Sokora and 455 XP with your previous bot, he’d have **655 XP** with Sokora afterwards.\n",
          "> 🟥 **Overwriting will REPLACE levels from Sokora’s existing leaderboard with the imported ones.**\n> ",
          "> For example, if member Goos has 200 XP with Sokora and 455 XP with your previous bot, he’d have **455 XP** with Sokora afterwards.",
        ].join("\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const expectContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 🚩 • What to expect from the command"),
      new TextDisplayBuilder().setContent(
        [
          "You’ll be shown an interactive list of bots to import from with an ’Import’ button. It will either proceed directly or prompt for an API key.",
          "Once ready you’ll have the options to merge, overwrite, or to preview (in YAML format) the data that’ll be imported.",
          "After importing, you’ll be shown the outcome. That’s it!",
        ].join("\n\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  await interaction.reply({
    components: [firstContainer, botsContainer, instructContainer, expectContainer],
    flags: ["Ephemeral", "IsComponentsV2"],
  });
}
