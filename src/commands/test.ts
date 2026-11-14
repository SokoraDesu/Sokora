import {
  codeBlock,
  EmbedBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { assertInteraction } from "types";

export const data = new SlashCommandBuilder()
  .setName("test")
  .setDescription("Run the Sokora test suite.")
  .setContexts(InteractionContextType.Guild);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  await interaction.deferReply();

  const output = (await Bun.$`bun test --timeout 15000`.nothrow()).stderr.toString();
  const delim = "-------------------------------|---------|---------|-------------------";

  const res = output.split(delim, 4)[3].trim();

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("IRL test suite")
        .setDescription(
          `# test suite executed\ncheck attachment for full output\n## overall result\n${codeBlock("typescript", res)}\n-# running on \`bun:test\` ${Bun.version_with_sha}`,
        )
        .setColor((await colorize({ hue: Sokolors.Yellow })) ?? null),
    ],
    files: [{ attachment: Buffer.from(output, "utf8"), name: "output.txt" }],
  });
}
