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
  type MessageCreateOptions,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { ERROR_CHANNEL_ID, MAX_INPUT_CHARS } from "utils/constants";
import { mention } from "utils/mention";
import { safeChannel, safeReply } from "utils/safeThings";
import { modalSubmit } from "utils/modalSubmit";
import { errorType } from "utils/errorType";
import { collect } from "utils/collector";

type ErrorableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | AnySelectMenuInteraction
  | ModalSubmitInteraction;

/** Options for an errorEmbed */
interface Options {
  /** The interaction that errored. Optional, you may need an errorEmbed in other contexts. */
  interaction?: ErrorableInteraction;
  /** The client. Provide always, even if you do provide an interaction (use `interaction.client` for easiness). */
  client?: Client;
  /** Error behind this errorEmbed. */
  error?: unknown;
  /** Short description of the error. */
  title?: string;
  /** The reason of the error. */
  reason?: string;
  /** The name of the file from where the error is coming from. */
  fileName?: string;
  /** If true, DMs the owner with this error. Requires `interaction`. */
  dmOwner?: boolean;
  /** Extra info to help pinpoint the issue. Add anything you want. */
  extras?: Dict<string | null>;
}

function addContent(title?: string, reason?: string): string {
  const content = [];
  if (title) content.push(`**${title}**`);
  if (reason) content.push(reason);
  if (!title && !reason)
    content.push(
      "The bot has experienced an internal error.\nPretty please join the support server if you wish to report the issue! https://discord.gg/c6C25P4BuY",
    );

  return content.join("\n");
}

function showErrors(
  container: ContainerBuilder,
  error: Error,
  fileName?: string,
  extras?: Options["extras"],
  interaction?: ErrorableInteraction,
): ContainerBuilder {
  return container
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
          error.stack
            ? (error.stack.length <= 2048
              ? codeBlock(error.stack)
              : "The error stacktrace is an attachment below due to it being too large.")
            : "No error stacktrace.",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**🛡️ • Pinpoint this issue**",
          interaction
            ? `**User is** <@${interaction.user.id}> (${interaction.user.id})\n**Guild is** ${interaction.guild?.name} (${interaction.guild?.id})\nError sent on **${mention(interaction.createdTimestamp, "DETAILED_TIMESTAMP")}**`
            : (extras && Object.keys(extras).length > 0
              ? Object.entries(extras)
                  .map(([extra, value]) => (value ? `\`${extra}\`: ${value}` : null))
                  .filter(extra => extra != null)
                  .join("\n")
              : "So, funnily enough, this errorEmbed relies on `client`, not `interaction`, so I cannot tell you who caused this. Good luck."),
        ].join("\n"),
      ),
    );
}

async function dispatchInternally(
  client: Client,
  messagePayload: MessageCreateOptions,
): Promise<void> {
  if (!ERROR_CHANNEL_ID) {
    console.warn(
      "hey, you don’t have ERROR_CHANNEL_ID set in .env and the bot tried to forward an error message to undefined :D",
    );
    return;
  }

  const channel = await safeChannel(client, ERROR_CHANNEL_ID);
  if (!channel?.isTextBased() || !channel.isSendable()) return;
  await channel.send(messagePayload);
  return;
}

/**
 * Builds a base errorEmbed. See {@linkcode errorEmbed}.
 *
 * @returns A fixed-length array with the Container 1st and the attachments 2nd.
 */
async function buildErrorEmbed(options: Options): Promise<[ContainerBuilder, AttachmentBuilder[]]> {
  const { title, reason, fileName, extras } = options;

  const error = errorType(options.error);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Something went wrong!"),
      new TextDisplayBuilder().setContent(addContent(title, reason)),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Red }));

  const files: AttachmentBuilder[] = [];

  if (options.error) {
    showErrors(container, error, fileName, extras);

    if (error.stack && error.stack.length >= 2048) {
      files.push(new AttachmentBuilder(Buffer.from(error.stack, "utf8"), { name: "error.txt" }));
      container.addFileComponents(new FileBuilder().setURL("attachment://error.txt"));
    }
  }

  return [container, files];
}

async function buildInteractiveErrorEmbed(
  options: Options,
  inherit?: [ContainerBuilder, AttachmentBuilder[]],
): Promise<[ContainerBuilder, AttachmentBuilder[]]> {
  const [container, files] = inherit ?? (await buildErrorEmbed(options));

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Hey, if you can…\n## Report the issue with the button below… please!",
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("please").setLabel("Report").setStyle(ButtonStyle.Primary),
      ),
    );

  return [container, files];
}

/**
 * Creates and dispatches a container containing an error.
 *
 * First argument is a boolean, **set to true for errors that we should become aware of, and to false for predictable errors (e.g. ones related to user input)**.
 *
 * @returns Void, all logic is self-contained.
 */
export async function errorEmbed(isException: boolean, options: Options): Promise<undefined> {
  const { interaction, dmOwner } = options;
  const client = interaction?.client ?? options.client;

  if (!client) throw new Error("errorEmbed cannot work without a client. This is a problem.");

  const error = errorType(options.error);

  const [container, files] = await buildErrorEmbed(options);
  const internalPayload: MessageCreateOptions = {
    flags: "IsComponentsV2",
    components: [container],
    files,
  };

  console.error(error);

  if (isException) {
    await dispatchInternally(client, internalPayload);

    if (!interaction) return;

    const [forwardedContainer, forwardedFiles] = await buildInteractiveErrorEmbed(options, [
      container,
      files,
    ]);

    const reply = await safeReply({
      interaction,
      replyOptions: {
        components: [forwardedContainer],
        files: forwardedFiles,
        flags: ["Ephemeral", "IsComponentsV2"],
      },
    });

    collect(
      interaction,
      reply,
      async (buttonInteraction: ButtonInteraction, halt, resetTime) => {
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
        resetTime();

        if (!modalInteraction) {
          halt();
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
            .filter(item => {
              return (
                item.contentType &&
                (item.contentType.startsWith("image/") || item.contentType.startsWith("video/"))
              );
            })
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
          halt();
          return;
        }

        const channel = await safeChannel(interaction.client, reportChannel);
        if (!channel?.isTextBased() || !channel.isSendable()) {
          halt();
          return;
        }
        await channel.send({
          components: [descriptionContainer, explanationContainer, forwardedContainer],
          files: forwardedFiles,
          flags: "IsComponentsV2",
        });
      },
      async () => {
        await interaction.deleteReply();
      },
    );
  } else {
    if (!interaction) return;
    await safeReply({
      interaction,
      replyOptions: {
        components: [container],
        files,
        flags: ["Ephemeral", "IsComponentsV2"],
      },
    });
  }

  if (!dmOwner) return;
  const dm = await (await interaction?.guild?.fetchOwner())?.createDM().catch(() => null);
  if (dm) await dm.send(internalPayload);
}
