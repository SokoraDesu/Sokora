import {
  AnySelectMenuInteraction,
  AttachmentBuilder,
  Client,
  ContainerBuilder,
  EmbedBuilder,
  FileBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  codeBlock,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { safeReply } from "utils/safeThings";
import { genColor, genColorCV2 } from "../colorGen";
import { errorType } from "../errorType";

/**
 * Sends the embed containing an error.
 * @param interaction The interaction (slash command).
 * @param title The error.
 * @param reason The reason of the error.
 * @param forward Whether or not should the error embed be forwarded to the error log channel.
 * @returns Embed with the error description.
 */
export async function errorEmbed(options: {
  interaction?: ChatInputCommandInteraction | ButtonInteraction;
  client?: Client;
  error?: unknown | Error;
  title?: string;
  reason?: string;
  log?: boolean;
  forward?: boolean;
  fileName?: string;
}) {
  const { interaction, title, reason, log, forward, fileName } = options;
  const client = options.client ? options.client : interaction ? interaction.client : null;
  if (!client && !interaction)
    return console.error(
      "You need to provide either a client or an interaction for errorEmbed to work.",
    );

  const error = errorType(options.error);
  const stack = error.stack;
  const content = [];
  if (title) content.push(`**${title}**`);
  if (reason) content.push(reason);
  if (!title && !reason)
    content.push(
      "The bot has experienced an internal error.\nThe team has been informed. If you keep encountering this issue, you can go to our [support server](https://discord.gg/c6C25P4BuY) to report it.",
    );

  const embed = new EmbedBuilder()
    .setAuthor({ name: "Something went wrong!" })
    .setDescription(content.join("\n"))
    .setColor(genColor(0));

  if (options.error) {
    embed.addFields(
      {
        name: "💬 • Error message",
        value: `${codeBlock(error.message)}${fileName ? `in \`${fileName}\`` : ""}`,
      },
      {
        name: "📜 • Error stack",
        value: stack
          ? stack.length <= 4096
            ? codeBlock(stack)
            : "The error stacktrace is an attachment below this embed due to it being too large."
          : "No error stacktrace.",
      },
      {
        name: "🛡️ • Pinpoint this issue",
        value: interaction ? `**User is:** <@${(interaction.user.id)}> (${interaction.user.id})\n**Guild is:** ${interaction.guild?.name} (${interaction.guild?.id})` : "So, funnily enough, this errorEmbed relies on `client`, not `interaction`, so I cannot tell you who caused this. Good luck."
      }
    );
  }

  const files: AttachmentBuilder[] = [];
  if (stack && stack.length >= 4096)
    files.push(new AttachmentBuilder(Buffer.from(stack, "utf8"), { name: "error.txt" }));

  if (forward) {
    const channel = (client ? client : interaction!.client).channels.cache.get(
      process.env.DEV_ERROR_CHANNEL_ID!,
    );
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({ embeds: [embed], files: files });
  }

  if (log) console.error(error);
  if (interaction)
    return await safeReply({
      interaction,
      replyOptions: {
        embeds: [embed],
        files: files,
        flags: "Ephemeral",
      },
    });
}

/**
 * Sends a CV2 container containing an error.
 * @param interaction The interaction.
 * @param title The error.
 * @param reason The reason of the error.
 * @param forward Whether or not should the error embed be forwarded to the error log channel.
 * @returns Embed with the error description.
 */
export async function errorEmbedCV2(options: {
  interaction?: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction;
  client?: Client;
  error?: unknown | Error;
  title?: string;
  reason?: string;
  log?: boolean;
  forward?: boolean;
}) {
  const { interaction, title, reason, log, forward } = options;
  const client = options.client ? options.client : interaction ? interaction.client : null;
  if (!client && !interaction)
    return console.error(
      "You need to provide either a client or an interaction for errorEmbed to work.",
    );

  const error = errorType(options.error);
  const stack = error.stack;
  const content = [];
  if (title) content.push(`**${title}**`);
  if (reason) content.push(reason);
  if (!title && !reason)
    content.push(
      "The bot has experienced an internal error.\nThe team has been informed. If you keep encountering this issue, you can go to our [support server](https://discord.gg/c6C25P4BuY) to report it.",
    );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Something went wrong!\n${content.join("\n")}`),
    )
    .setAccentColor(genColorCV2(0)!);

  if (options.error) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`💬 • Error message\n${codeBlock(error.message)}`),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `📜 • Error stack\n${
            stack
            ? stack.length <= 4096
            ? codeBlock(stack)
            : "The error stacktrace is an attachment below this embed due to it being too large."
            : "No error stacktrace."
          }`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `🛡️ • Pinpoint this issue\n${interaction ? `**User is:** <@${(interaction.user.id)}> (${interaction.user.id})\n**Guild is:** ${interaction.guild?.name} (${interaction.guild?.id})` : "So, funnily enough, this errorEmbed relies on `client`, not `interaction`, so I cannot tell you who caused this. Good luck."
          }`,
        ),
      );
  }

  const files: AttachmentBuilder[] = [];
  if (stack && stack.length >= 4096) {
    files.push(new AttachmentBuilder(Buffer.from(stack, "utf8"), { name: "error.txt" }));
    container.addFileComponents(new FileBuilder().setURL("attachment://error.txt"));
  }

  if (forward) {
    const channel = (client ? client : interaction!.client).channels.cache.get(
      process.env.DEV_ERROR_CHANNEL_ID!,
    );
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({ components: [container], flags: "IsComponentsV2" });
  }

  if (log) console.error(error);
  if (interaction)
    return await safeReply({
      interaction,
      replyOptions: { components: [container], flags: ["Ephemeral", "IsComponentsV2"] },
    });
}
