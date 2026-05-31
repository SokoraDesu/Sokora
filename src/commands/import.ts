import { Leveler, SupportedBots } from "@hokkiai/djs-level-importer";
import { calculateLevel, getUserXp, setUserXp } from "database/leveling";
import { getSetting } from "database/settings";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  codeBlock,
  ContainerBuilder,
  FileBuilder,
  LabelBuilder,
  ModalBuilder,
  PermissionsBitField,
  SectionBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import { buttonCheck } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { modalSubmit } from "utils/modalSubmit";
import { safeReply } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("import")
  .setDescription("Imports leveling data from another bot.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

function safeStringify(object: unknown): string {
  try {
    const string_ = JSON.stringify(object, null, 2);
    if (string_.length < 3800) return string_;
    return (
      string_.slice(0, 3800) + "\n// etc... (had to trim it because of discord character limits)"
    );
  } catch {
    return "[Unserializable data, please report this as an issue]";
  }
}

async function collapse(
  error: unknown,
  cID: keyof typeof SupportedBots,
  interaction: ChatInputCommandInteraction,
  containerHelper: (
    container: ContainerBuilder,
    options: {
      content?: string;
      buttons?: boolean;
      error?: boolean;
      json?: boolean;
    },
  ) => Promise<ContainerBuilder>,
): Promise<Message | InteractionResponse> {
  await interaction.deleteReply();
  const errorContainer = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent("# Something went wrong..."),
    new TextDisplayBuilder().setContent(
      [
        cID === "MEE6"
          ? "Open the leaderboard settings in the MEE6 dashboard and enable the option `Make my server's leaderboard public`. Otherwise we can't import data."
          : (cID === "LURKR"
            ? "Check that the API token you provided is correct."
            : "We don't really know what went wrong. Maybe you should try again?"),
        "You might as well check the error message shown below, it *might* explain better what's wrong.",
        "If after doing all of that Sokora keeps failing to import your data, please send the error message to Sokora's team so we can try to fix this.",
        codeBlock("yaml", error instanceof Error ? (error.stack ?? error.message) : String(error)),
      ].join("\n\n"),
    ),
  );

  return await safeReply({
    interaction,
    replyOptions: {
      components: [await containerHelper(errorContainer, { error: true })],
      flags: ["Ephemeral", "IsComponentsV2"],
    },
  });
}

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  // [TODO] add return to not keep running the command lmao
  const user = interaction.client.user;
  const avatar = user.displayAvatarURL();
  if (!interaction.guild || !interaction.guildId) return;

  async function containerHelper(
    container: ContainerBuilder,
    options: {
      content?: string;
      buttons?: boolean;
      error?: boolean;
      json?: boolean;
    },
  ): Promise<ContainerBuilder> {
    const { content, buttons, error, json } = options;
    if (content) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    if (buttons)
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("merge")
            .setLabel("Merge data")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("overwrite")
            .setLabel("Overwrite data")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(json ? "return" : "check")
            .setLabel(json ? "Return" : "Check JSON data first")
            .setStyle(ButtonStyle.Primary),
        ),
      );

    const color = await colorize({ user, avatar, hue: 300 });
    const errorColor = await colorize({ user, avatar, hue: Sokolors.Red });
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Powered by `djs-level-importer`, an open-source library by Sokora and others.",
        ),
      )
      .setAccentColor(error ? errorColor : color);

    return container;
  }

  const bots: { content: string; id: keyof typeof SupportedBots }[] = [
    { content: "Tatsu\n-# Import from [Tatsu](https://tatsu.gg/)", id: "TATSU" },
    { content: "MEE6\n-# Import from [MEE6](http://mee6.xyz/)", id: "MEE6" },
    { content: "Lurkr\n-# Import from [Lurkr](https://lurkr.gg/)", id: "LURKR" },
  ];
  const containerComponents = [];
  for (const bot of bots)
    containerComponents.push(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bot.content))
        .setButtonAccessory(
          new ButtonBuilder().setCustomId(bot.id).setLabel("Import").setStyle(ButtonStyle.Primary),
        ),
    );

  const container = new ContainerBuilder().addSectionComponents(containerComponents);
  const reply = await safeReply({
    interaction,
    replyOptions: {
      components: [await containerHelper(container, {})],
      flags: ["Ephemeral", "IsComponentsV2"],
    },
  });
  const collector = reply.createMessageComponentCollector({ time: 60_000 });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    const cID = buttonInteraction.customId as keyof typeof SupportedBots;
    const bots = {
      name: cID === "MEE6" ? cID.toUpperCase() : cID,
      data: [
        "- User XP",
        cID === "TATSU" ? "-# Note: Tatsu doesn't have role rewards." : "- Role rewards",
        "-# Settings like difficulty (which dictate the amount of XP needed to levelup) can't be imported. Levels might immediately change when chatting if you don't manually change the difficulty (and the current one differs too much from this one, which isn't necessarily the case).",
      ].join("\n"),
    };

    try {
      async function construct(
        lurkrKey?: string,
        modalInteraction?: ModalSubmitInteraction,
      ): Promise<void> {
        if (!interaction.guildId) return;
        const leveler = new Leveler({
          guild: interaction.guildId,
          tatsu_api: process.env.TATSU_TOKEN,
          lurkr_api: lurkrKey,
        });
        let levels =
          cID === "MEE6"
            ? await leveler.GetLeaderboard(SupportedBots.MEE6)
            : await leveler.GetLeaderboard(SupportedBots.TATSU);

        if (cID === "LURKR" && lurkrKey) levels = await leveler.GetLeaderboard(SupportedBots.LURKR);
        const container1 = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `Thanks for switching to Sokora! We will import leveling info from **${bots.name}** that we can gather. This includes a total of **${levels.length} entries**.`,
              `Data we can import from ${bots.name} is:\n${bots.data}`,
              `You may now import data by **merging** (adding imported XP to Sokora's XP) or by **overwriting** (removing Sokora's leveling data, then adding imported XP data). You can also review the JSON data that is to be imported, just in case.`,
            ].join("\n\n"),
          ),
        );

        const replyInteraction = modalInteraction ?? buttonInteraction;
        const reply1 = await safeReply({
          interaction: replyInteraction,
          editOptions: { components: [await containerHelper(container1, { buttons: true })] },
        });

        if (modalInteraction) await reply.delete();
        collector.stop("bot_chosen");
        const collector1 = reply1.createMessageComponentCollector({ time: 60_000 });
        collector1.on("collect", async (buttonInteraction1: ButtonInteraction) => {
          if (
            await buttonCheck({
              i: buttonInteraction1,
              interaction: replyInteraction,
              reply: reply1,
            })
          )
            return;

          collector1.resetTimer({ time: 60_000 });
          let content;
          switch (buttonInteraction1.customId) {
            case "check": {
              const levelData = safeStringify(levels);
              const checkContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `## This is what we'll import from ${bots.name}\n${
                    levelData.length <= 4096
                      ? codeBlock(levelData)
                      : "The level data is an attachment due to it being too large."
                  }`,
                ),
              );

              const files: AttachmentBuilder[] = [];
              if (levelData.length >= 4096) {
                files.push(
                  new AttachmentBuilder(Buffer.from(levelData, "utf8"), { name: "levels.txt" }),
                );
                checkContainer.addFileComponents(
                  new FileBuilder().setURL("attachment://levels.txt"),
                );
              }

              await safeReply({
                interaction: buttonInteraction1,
                replyOptions: {
                  components: [
                    await containerHelper(checkContainer, { buttons: true, json: true }),
                  ],
                  files: files,
                },
              });
              break;
            }
            case "return": {
              await safeReply({
                interaction: buttonInteraction1,
                replyOptions: { components: [container1] },
              });
              break;
            }
            case "merge":
            case "overwrite": {
              content = `# ${buttonInteraction1.customId == "merge" ? "Updating" : "Overwriting"} data for all users...`;
              const res = [];
              await safeReply({
                interaction: buttonInteraction1,
                replyOptions: {
                  components: [await containerHelper(new ContainerBuilder(), { content })],
                },
              });

              if (!interaction.guild || !interaction.guildId) return;
              const difficulty = (await getSetting(
                interaction.guild.id,
                "leveling",
                "difficulty",
              )) as number;
              for (const user of interaction.guild.members.cache) {
                if (user[1].user.bot) continue;
                const imported = levels.find(lev => lev.uid == user[1].id);
                if (!imported) {
                  res.push(
                    `${user[1].user.username} wasn't imported (had no data saved in the imported dataset)`,
                  );
                  continue;
                }
                const previousXp = await getUserXp(interaction.guildId, user[1].id);
                const newXp =
                  (buttonInteraction1.customId == "merge" ? previousXp : 0) + imported.current_xp;
                await setUserXp(interaction.guildId, user[1].id, newXp);
                res.push(
                  `${user[1].user.username} updated from ${previousXp} XP (level ${calculateLevel({ xp: previousXp, difficulty })}) to **XP ${newXp} (level ${calculateLevel({ xp: newXp, difficulty })})**.`,
                );
              }

              content = `# Done!\n${res.join("\n")}`;
              await safeReply({
                interaction: buttonInteraction1,
                replyOptions: {
                  components: [await containerHelper(new ContainerBuilder(), { content })],
                },
              });
            }
          }
        });

        collector1.on("end", async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {
            if (Error.isError(error) && error.message.toLowerCase().includes("unknown message"))
              return;
            throw error;
          }
        });
      }

      if (cID == "LURKR") {
        const modal = new ModalBuilder()
          .setCustomId(cID)
          .setTitle(`•  API key to import`)
          .addLabelComponents(
            new LabelBuilder()
              .setLabel("Value")
              .setTextInputComponent(
                new TextInputBuilder()
                  .setCustomId("setting")
                  .setPlaceholder("Type in the value")
                  .setMaxLength(4000)
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true),
              ),
          );

        await buttonInteraction.showModal(modal);
        const modalInteraction = await modalSubmit(buttonInteraction);
        collector.resetTimer({ time: 60_000 });
        if (!modalInteraction) return;

        try {
          await construct(modalInteraction.fields.getTextInputValue("setting"), modalInteraction);
        } catch (error) {
          return await collapse(error, cID, interaction, containerHelper);
        }
      } else await construct();
    } catch (error) {
      return await collapse(error, cID, interaction, containerHelper);
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason === "bot_chosen") return;
    try {
      await interaction.deleteReply();
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
