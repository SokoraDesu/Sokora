import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";

export const data = new SlashCommandSubcommandBuilder()
  .setName("import")
  .setDescription("Show help with how to import leveling data from other bots.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const avatar = interaction.client.user.displayAvatarURL();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}Dynamic (variables)`,
      iconURL: avatar,
    })
    .setDescription(
      "You can use the `/import` command to bring your leaderboard from other bots into Sokora.",
    )
    .setColor(await colorize({ hue: Sokolors.Blue }))
    .setFields([
      {
        name: "📜 • Supported bots",
        value: [
          "- MEE6 • [mee6.xyz](https://mee6.xyz)",
          "Tatsu • [tatsu.gg](https://tatsu.gg)",
          "Lurkr • [lurkr.gg](https://lurkr.gg)",
          "*More to be added soon!*",
        ].join("\n- "),
      },
      {
        name: "👀 • What you need to do",
        value: [
          "Sokora imports data using the bot provider's API (if any). This requires for both Tatsu and MEE6 **that you make your leaderboard public**, and doesn't require further configuration. For Lurkr however, this is a bit harder as you need to provide your own API token with read only permissions on your server's leaderboard. You can do so from Lurkr's dashboard.\n",
          "With everything provided, all you need to do is to choose between performing a 🟩 **data merge** or a 🟥 **data overwrite**.\n",
          "> 🟩 **Merging will ADD levels on top of Sokora's existing leaderboard.**",
          "> For example, if member Serge has 200 XP with Sokora and 455 XP with your previous bot, he'd have **655 XP** with Sokora afterwards.\n",
          "> 🟥 **Overwriting will REPLACE levels from Sokora's existing leaderboard with the imported ones.**",
          "> For example, if member Serge has 200 XP with Sokora and 455 XP with your previous bot, he'd have **455 XP** with Sokora afterwards.",
        ].join("\n"),
      },
      {
        name: "🚩 • What to expect from the command",
        value: [
          "You'll be shown an interactive menu, a list of bots to import from with an 'Import' button. For Lurkr it triggers a modal to input your API key, for other bots it just tries to fetch your server's leaderboard.",
          "Once ready you'll have the options to merge, overwrite, or to preview (in a readable-ish JSON format) the data that'll be imported.",
          "After importing, you'll be shown the outcome. That's it!",
        ].join("\n\n"),
      },
    ]);

  await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
}
