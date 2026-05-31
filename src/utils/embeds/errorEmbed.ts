import {
  AttachmentBuilder,
  codeBlock,
  ContainerBuilder,
  FileBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type InteractionResponse,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { safeChannel, safeReply } from "utils/safeThings";
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
  interaction?: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction;
  client?: Client;
  error?: unknown;
  title?: string;
  reason?: string;
  log?: boolean;
  forward?: boolean;
  fileName?: string;
  dmOwner?: boolean;
}): Promise<Message | InteractionResponse | undefined> {
  const { interaction, title, reason, log, forward, fileName, dmOwner } = options;
  const client = options.client ?? interaction?.client;
  if (!client) {
    console.error("You need to provide either a client or an interaction for errorEmbed to work.");
    return;
  }

  const error = errorType(options.error);
  const stack = error.stack;
  const content = [];
  if (title) content.push(`**${title}**`);
  if (reason) content.push(reason);
  if (!title && !reason)
    content.push(
      `The bot has experienced an internal error.\nThe team has been informed. [If you keep encountering this issue, please go to our support server to report it.](https://discord.gg/c6C25P4BuY)`,
    );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("**Something went wrong!**"),
      new TextDisplayBuilder().setContent(content.join("\n")),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

  if (options.error)
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "**💬 • Error message**",
            `${codeBlock(error.message)}${fileName ? `in \`${fileName}\`` : ""}`,
          ].join("\n"),
        ),
        new TextDisplayBuilder().setContent(
          [
            "**📜 • Error stack**",
            stack
              ? (stack.length <= 4096
                ? codeBlock(stack)
                : "The error stacktrace is an attachment below this embed due to it being too large.")
              : "No error stacktrace.",
          ].join("\n"),
        ),
      );

  const files: AttachmentBuilder[] = [];
  if (stack && stack.length >= 4096) {
    files.push(new AttachmentBuilder(Buffer.from(stack, "utf8"), { name: "error.txt" }));
    container.addFileComponents(new FileBuilder().setURL("attachment://error.txt"));
  }

  if (forward) {
    const developmentErrorChannel = process.env.DEV_ERROR_CHANNEL_ID;
    if (!developmentErrorChannel) {
      console.log(
        "hey, you don't have DEV_ERROR_CHANNEL_ID set in .env and the bot tried to forward an error message to undefined :D",
      );
      console.error(error);
      return;
    }

    const channel = await safeChannel(client, developmentErrorChannel);
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({ components: [container], files, flags: "IsComponentsV2" });
  }

  if (dmOwner) {
    const dm = await (await interaction?.guild?.fetchOwner())?.createDM().catch(() => null);
    if (dm) await dm.send({ components: [container], files, flags: "IsComponentsV2" });
  }

  if (log) console.error(error);
  if (interaction)
    return await safeReply({
      interaction,
      replyOptions: { components: [container], files, flags: ["Ephemeral", "IsComponentsV2"] },
    });
}

export async function buttonCheck(options: {
  i: ButtonInteraction | AnySelectMenuInteraction;
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;
  reply: Message | InteractionResponse;
  noExecuteError?: boolean;
}): Promise<Awaited<ReturnType<typeof errorEmbed>>> {
  const { i, interaction, reply, noExecuteError } = options;
  if (i.message.id != (await reply.fetch()).id)
    return await errorEmbed({
      interaction: i,
      title:
        "For some reason, this click would've caused the bot to error. Thankfully, this message right here prevents that.",
    });

  if (noExecuteError) return;
  if (i.user.id != interaction.user.id)
    return await errorEmbed({
      interaction: i,
      title: "You are not the person who executed this command.",
    });
}
