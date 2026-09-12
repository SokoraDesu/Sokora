import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  codeBlock,
  ContainerBuilder,
  FileBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION, MAX_INPUT_CHARS } from "utils/constants";
import { mention } from "utils/mention";
import { safeChannel, safeReply } from "utils/safeThings";
import { errorType } from "../errorType";
import { modalSubmit } from "utils/modalSubmit";

/**
 * Sends a container containing an error.
 * @param interaction The interaction (slash command).
 * @param client The client, use when interaction is unavailable.
 * @param error The error object.
 * @param title Short description of the error.
 * @param reason The reason of the error.
 * @param log Logs the error in the console.
 * @param forward Forwards the error to the error log channel.
 * @param fileName The name of the file from where the error is coming from.
 * @param dmOwner DMs the owner with this error.
 * @returns Container with the error description.
 */
export async function errorEmbed(options: {
  interaction?:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | AnySelectMenuInteraction
    | ModalSubmitInteraction;
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

  function addContent(shouldFwdContainer: boolean): string {
    const content = [];
    if (title) content.push(`**${title}**`);
    if (reason) content.push(reason);
    if (!shouldFwdContainer && !title && !reason) {
      content.push(
        "The bot has experienced an internal error.\nPretty please join the support server if you wish to report the issue! https://discord.gg/c6C25P4BuY",
      );

      if (forward)
        content.push(
          "-# Or, if you can…\n## report the issue with the button at the bottom… please…",
        );
    }

    return content.join("\n");
  }

  function showErrors(container: ContainerBuilder, shouldUseEmojis: boolean): ContainerBuilder {
    return container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          shouldUseEmojis ? "**💬 • Error message**" : "**error message**",
          `${codeBlock(error.message)}${fileName ? `in \`${fileName}\`` : ""}`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          shouldUseEmojis ? "**📜 • Error stack**" : "**error stack**",
          stack
            ? (stack.length <= 2048
              ? codeBlock(stack)
              : "The error stacktrace is an attachment below due to it being too large.")
            : "No error stacktrace.",
        ].join("\n"),
      ),
    );
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Something went wrong!"),
      new TextDisplayBuilder().setContent(addContent(false)),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

  const forwardContainer = new ContainerBuilder().setAccentColor(
    await colorize({ hue: Sokolors.Red }),
  );

  if (addContent(true))
    forwardContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(addContent(true)),
    );

  if (options.error) {
    container.addSeparatorComponents(new SeparatorBuilder());
    showErrors(container, true);
    showErrors(forwardContainer, false);
  }

  if (interaction?.guild)
    forwardContainer
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**guild ID**: ${interaction.guild.id}`,
            `**user ID**: ${interaction.user.id}`,
            `error sent on **${mention(interaction.createdTimestamp, "DETAILED_TIMESTAMP")}**`,
          ].join("\n"),
        ),
      );

  const files: AttachmentBuilder[] = [];
  if (stack && stack.length >= 2048) {
    files.push(new AttachmentBuilder(Buffer.from(stack, "utf8"), { name: "error.txt" }));
    container.addFileComponents(new FileBuilder().setURL("attachment://error.txt"));
  }

  if (forward) {
    const errorChannel = process.env.ERROR_CHANNEL_ID;
    if (!errorChannel) {
      console.error(error);
      console.log(
        "hey, you don’t have ERROR_CHANNEL_ID set in .env and the bot tried to forward an error message to undefined :D",
      );
      return;
    }

    const channel = await safeChannel(client, errorChannel);
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({ components: [forwardContainer], files, flags: "IsComponentsV2" });
  }

  if (dmOwner) {
    const dm = await (await interaction?.guild?.fetchOwner())?.createDM().catch(() => null);
    if (dm) await dm.send({ components: [container], files, flags: "IsComponentsV2" });
  }

  if (log) console.error(error);
  if (interaction) {
    if (forward)
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("please")
            .setLabel("Report")
            .setStyle(ButtonStyle.Primary),
        ),
      );

    const reply = await safeReply({
      interaction,
      replyOptions: { components: [container], files, flags: ["Ephemeral", "IsComponentsV2"] },
    });

    const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
    collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
      const modal = new ModalBuilder()
        .setCustomId("modalpls")
        .setTitle("•  Report the issue pretty please")
        .addLabelComponents(
          new LabelBuilder()
            .setLabel("Mind describing? 😟")
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("description")
                .setPlaceholder("Pleasepleasepleasepleasepleasplesae 🥹")
                .setMaxLength(MAX_INPUT_CHARS)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true),
            ),
          new LabelBuilder()
            .setLabel("How????????????????????????")
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("explanation")
                .setPlaceholder("Now how the hell did you reproduce the issue…? please say ❤️‍🩹")
                .setMaxLength(MAX_INPUT_CHARS)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false),
            ),
          new LabelBuilder()
            .setLabel("Any screenies? (or videos) 🥺")
            .setFileUploadComponent(
              new FileUploadBuilder().setCustomId("images").setMaxValues(10).setRequired(false),
            ),
        );

      const modalInteraction = await modalSubmit(buttonInteraction, modal);
      collector.resetTimer({ time: COLLECTOR_DURATION });

      if (!modalInteraction) {
        collector.stop();
        return;
      }

      const modalContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Thank you for reporting! You’ve made Goos proud 🥹\nWe’ll look into this error and properly thank you in a future patch release 🫶",
          ),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Purple }));

      await safeReply({
        interaction: modalInteraction,
        replyOptions: { components: [modalContainer], flags: ["Ephemeral", "IsComponentsV2"] },
      });

      const descriptionContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            modalInteraction.fields.getTextInputValue("description"),
          ),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Green }));

      const media = modalInteraction.fields.getUploadedFiles("images");
      if (media) {
        const actualMediaGallery = media
          .filter(
            item =>
              item.contentType &&
              (item.contentType.startsWith("image/") || item.contentType.startsWith("video/")),
          )
          .map(image => new MediaGalleryItemBuilder().setURL(image.url))
          .toReversed();

        if (actualMediaGallery)
          descriptionContainer.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(actualMediaGallery),
          );
      }

      descriptionContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# description"),
      );

      const explanationContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            modalInteraction.fields.getTextInputValue("explanation"),
          ),
          new TextDisplayBuilder().setContent("-# explanation"),
        )
        .setAccentColor(await colorize({ hue: Sokolors.Yellow }));

      const reportChannel = process.env.REPORT_CHANNEL_ID;
      if (!reportChannel) {
        console.error(error);
        console.log(
          "hey, you don’t have REPORT_CHANNEL_ID set in .env and someone somehow reported an issue for the bot to send it to undefined :D",
        );
        collector.stop();
        return;
      }

      const channel = await safeChannel(client, reportChannel);
      if (!channel?.isTextBased() || !channel.isSendable()) {
        collector.stop();
        return;
      }
      await channel.send({
        components: [descriptionContainer, explanationContainer, forwardContainer],
        files,
        flags: "IsComponentsV2",
      });
    });

    collector.on("end", async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
        throw error;
      }
    });

    return reply;
  }
}

/**
 * Checks buttons (or select menus) for common errors.
 * @param i The component to check.
 * @param reply The reply that will be checked against the original message.
 * @param interaction The interaction that will have its user checked against the button's interaction
 * @param noExecuteError Makes the function not check user IDs.
 * @returns An errorEmbed if something goes wrong.
 */
export async function buttonCheck(options: {
  i: ButtonInteraction | AnySelectMenuInteraction;
  reply: Message | InteractionResponse;
  interaction?:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | AnySelectMenuInteraction;
  noExecuteError?: boolean;
}): Promise<Awaited<ReturnType<typeof errorEmbed>>> {
  const { i, interaction, reply, noExecuteError } = options;

  if (i.customId == "please") return;
  if (i.message.id != (await reply.fetch()).id)
    return await errorEmbed({
      interaction: i,
      title:
        "For some reason, this click would’ve caused the bot to error. Thankfully, this message right here prevents that.",
    });

  if (!noExecuteError && interaction && i.user.id != interaction.user.id)
    return await errorEmbed({
      interaction: i,
      title: "You are not the person who executed this command.",
    });
}
