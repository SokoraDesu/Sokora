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
  type ModalSubmitInteraction,
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
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION, MAX_INPUT_CHARS } from "utils/constants";
import { modalSubmit } from "utils/modalSubmit";
import { safeEdit, safeReply } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("import")
  .setDescription("Imports leveling data from another bot.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

function safeStringify(object: unknown): string {
  try {
    const string_ = JSON.stringify(object, null, 2);
    if (string_.length < MAX_INPUT_CHARS) return string_;
    return `${string_.slice(0, MAX_INPUT_CHARS)}\n// etc… (had to trim it because of discord character limits)`;
  } catch {
    return "[Unserializable data, please report this as an issue]";
  }
}

async function collapse(
  error: unknown,
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  await interaction.deleteReply();
  return await errorEmbed({ interaction, error, log: true, forward: true, fileName: "import" });
}

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = interaction.client.user;
  const avatar = user.displayAvatarURL();
  const guild = interaction.guild;
  const guildID = interaction.guildId;
  if (!guild || !guildID) return;

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

  const bots: { content: string; id: keyof typeof SupportedBots; userID: string }[] = [
    {
      content: "🟢  •  Tatsu\n-# Import from [Tatsu](https://tatsu.gg/)",
      id: "TATSU",
      userID: "172002275412279296",
    },
    {
      content: "🔵  •  MEE6\n-# Import from [MEE6](https://mee6.xyz/)",
      id: "MEE6",
      userID: "159985870458322944",
    },
    {
      content: "🟡  •  Lurkr\n-# Import from [Lurkr](https://lurkr.gg/)",
      id: "LURKR",
      userID: "506186003816513538",
    },
  ];

  const containerComponents = Array.from(bots, bot =>
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

  if (!reply) {
    await collapse("For some reason, a reply wasn’t sent your way.", interaction);
    return;
  }

  const collector = reply?.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;

    collector.resetTimer({ time: COLLECTOR_DURATION });
    const cID = buttonInteraction.customId;
    if (cID == "please") return;

    const bots = {
      name: cID === "MEE6" ? cID.toUpperCase() : cID,
      data: [
        "- User XP",
        cID === "TATSU" ? "-# Note: Tatsu doesn’t have role rewards." : "- Role rewards",
        "-# Settings like difficulty (which dictate the amount of XP needed to levelup) can’t be imported. Levels might immediately change when chatting if you don’t manually change the difficulty (and the current one differs too much from this one, which isn’t necessarily the case).",
      ].join("\n"),
    };

    async function construct(
      lurkrKey?: string,
      modalInteraction?: ModalSubmitInteraction,
    ): Promise<void> {
      if (!guildID) return;
      const leveler = new Leveler({
        guild: guildID,
        tatsu_api: process.env.TATSU_TOKEN,
        lurkr_api: lurkrKey,
      });

      const levels =
        cID === "MEE6"
          ? await leveler.GetLeaderboard(SupportedBots.MEE6)
          : (cID === "LURKR" && lurkrKey
            ? await leveler.GetLeaderboard(SupportedBots.LURKR)
            : await leveler.GetLeaderboard(SupportedBots.TATSU));

      const switchContainer = new ContainerBuilder()
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("back")
              .setLabel("Return")
              .setStyle(ButtonStyle.Secondary),
          ),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `Thanks for switching to Sokora! We will import leveling info from **${bots.name}** that we can gather. This includes a total of **${levels.length} entries**.`,
              `Data we can import from ${bots.name} is:\n${bots.data}`,
              `You may now import data by **merging** (adding imported XP to Sokora’s XP) or by **overwriting** (removing Sokora’s leveling data, then adding imported XP data). You can also review the JSON data that is to be imported, just in case.`,
            ].join("\n\n"),
          ),
        );

      const replyInteraction = modalInteraction ?? buttonInteraction;
      await safeEdit({
        interaction: replyInteraction,
        editOptions: { components: [await containerHelper(switchContainer, { buttons: true })] },
      });

      if (modalInteraction) await reply.delete();
      let content;
      switch (cID) {
        case "back": {
          await safeEdit({ interaction, editOptions: { components: [container] } });
          break;
        }
        case "check": {
          const levelData = safeStringify(levels);
          const checkContainer = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## This is what we’ll import from ${bots.name}\n${
                levelData.length <= 2048
                  ? codeBlock(levelData)
                  : "The level data is an attachment due to it being too large."
              }`,
            ),
          );

          const files: AttachmentBuilder[] = [];
          if (levelData.length > 2048) {
            files.push(
              new AttachmentBuilder(Buffer.from(levelData, "utf8"), { name: "levels.txt" }),
            );
            checkContainer.addFileComponents(new FileBuilder().setURL("attachment://levels.txt"));
          }

          await safeEdit({
            interaction: buttonInteraction,
            editOptions: {
              components: [await containerHelper(checkContainer, { buttons: true, json: true })],
              files,
            },
          });
          break;
        }
        case "return": {
          await safeEdit({
            interaction: buttonInteraction,
            editOptions: { components: [switchContainer] },
          });
          break;
        }
        case "merge":
        case "overwrite": {
          content = `## ${cID == "merge" ? "Updating" : "Overwriting"} data for all users…`;
          const res = [];
          await safeEdit({
            interaction: buttonInteraction,
            editOptions: {
              components: [await containerHelper(new ContainerBuilder(), { content })],
            },
          });

          if (!guild || !guildID) return;
          const difficulty = await getSetting(guildID, "leveling", "difficulty");

          for (const user of guild.members.cache) {
            if (user[1].user.bot) continue;
            const imported = levels.find(lev => lev.uid == user[1].id);
            if (!imported) {
              res.push(
                `${user[1].user.username} wasn’t imported (had no data saved in the imported dataset)`,
              );
              continue;
            }

            const previousXp = await getUserXp(guildID, user[1].id);
            const newXp = (cID == "merge" ? previousXp : 0) + imported.current_xp;
            await setUserXp(guildID, user[1].id, newXp);
            res.push(
              `${user[1].user.username} updated from ${previousXp} XP (level ${calculateLevel({ xp: previousXp, difficulty })}) to **XP ${newXp} (level ${calculateLevel({ xp: newXp, difficulty })})**.`,
            );
          }

          content = `## Done!\n${res.join("\n")}`;
          await safeEdit({
            interaction: buttonInteraction,
            editOptions: {
              components: [await containerHelper(new ContainerBuilder(), { content })],
            },
          });
        }
      }
    }

    if (cID != "LURKR") {
      await construct();
      return;
    }
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
              .setMaxLength(MAX_INPUT_CHARS)
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          ),
      );

    const modalInteraction = await modalSubmit(buttonInteraction, modal, "import");
    collector.resetTimer({ time: COLLECTOR_DURATION });
    if (modalInteraction)
      try {
        await construct(modalInteraction.fields.getTextInputValue("setting"), modalInteraction);
      } catch (error) {
        return await collapse(error, interaction);
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
