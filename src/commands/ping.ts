import {
  ContainerBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import ms from "enhanced-ms";
import { colorize, Sokolors } from "utils/colorize";
import { replace } from "utils/replace";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Shows the current ping and uptime of Sokora.")
  .setContexts(InteractionContextType.Guild);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const sent = await interaction.reply({ content: "a", withResponse: true });
  if (!sent.resource) return;

  const message = sent.resource.message;
  if (!message) return;

  const client = interaction.client;
  const user = client.user;
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Pong!"),
      new TextDisplayBuilder().setContent(
        [
          `\`Latency\` **${message.createdTimestamp - interaction.createdTimestamp}ms**.`,
          `\`WebSocket heartbeat\` **${client.ws.ping}ms**.`,
          `\`Bot uptime\` **${ms(client.uptime, "short")}**.`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(`-# ${replace("(madeWith)")}`),
    )
    .setAccentColor(
      await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Purple }),
    );

  await interaction.editReply({ content: "", components: [container], flags: "IsComponentsV2" });
}
