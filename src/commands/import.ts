import { Supported, type SupportedAndRewarded } from "@subetedesu/honlvlimport";
import { buildLeveler, importLevels } from "database/leveling";
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
  type User,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type Guild,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION, MAX_INPUT_CHARS } from "utils/constants";
import { modalSubmit } from "utils/modalSubmit";
import { safeEdit, safeReply } from "utils/safeThings";
import { assertInteraction } from "types";
import { isButtonErrory } from "utils/buttonCheck";

export const data = new SlashCommandBuilder()
  .setName("import")
  .setDescription("Imports leveling data from another bot.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

function safeStringify(object: unknown): string {
  try {
    const string_ = Bun.YAML.stringify(object, null, 2);
    return string_.length < MAX_INPUT_CHARS
      ? string_
      : `${string_.slice(0, MAX_INPUT_CHARS)}\n# etc… (had to trim it because of discord character limits)`;
  } catch {
    return "[Unserializable data, please report this as an issue]";
  }
}

async function collapse(error: unknown, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deleteReply();
  return await errorEmbed(true, { interaction, error, fileName: "import" });
}

async function containerHelper(
  container: ContainerBuilder,
  user: User,
  avatar: string,
  options: {
    content?: string;
    buttons?: boolean;
    error?: boolean;
    yaml?: boolean;
  },
): Promise<ContainerBuilder> {
  const { content, buttons, error, yaml } = options;
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
          .setCustomId(yaml ? "return" : "check")
          .setLabel(yaml ? "Return" : "Check YAML data first")
          .setStyle(ButtonStyle.Primary),
      ),
    );

  const color = await colorize({ user, avatar, hue: Sokolors.Purple });
  const errorColor = await colorize({ user, avatar, hue: Sokolors.Red });
  container.setAccentColor(error ? errorColor : color);

  return container;
}

async function construct(
  user: User,
  avatar: string,
  guild: Guild,
  cID: string,
  container: ContainerBuilder,
  interaction: ChatInputCommandInteraction,
  buttonInteraction: ButtonInteraction,
  reply: Message | InteractionResponse,
  apiKey?: string,
  target?: keyof typeof Supported,
  modalInteraction?: ModalSubmitInteraction,
): Promise<void> {
  const leveler = buildLeveler(guild.id, apiKey, target);

  const levels = await leveler.GetLeaderboard(Supported[cID as keyof typeof Supported]);
  const rewards = await leveler.GetRewards(
    Supported[cID as keyof typeof Supported] as unknown as SupportedAndRewarded,
  );

  const bots = {
    name: cID,
    data: [
      "- User XP",
      `${cID === "MEE6" ? "- Level rewards if present\n" : ""}-# Settings like difficulty (which dictate the amount of XP needed to levelup) can’t be imported. Levels might immediately change when chatting if you don’t manually change the difficulty (and the current one differs too much from this one, which isn’t necessarily the case).`,
    ].join("\n"),
  };

  const switchContainer = new ContainerBuilder()
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("back").setLabel("Return").setStyle(ButtonStyle.Secondary),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `Thanks for switching to Sokora! We will import leveling info from **${bots.name}** that we can gather. This includes a total of **${levels.length} entries**.`,
          `Data we can import from ${bots.name} is:\n${bots.data}`,
          `You may now import data by **merging** (adding imported XP to Sokora’s XP) or by **overwriting** (removing Sokora’s leveling data, then adding imported XP data). You can also review the YAML data that is to be imported, just in case.`,
        ].join("\n\n"),
      ),
    );

  const replyInteraction = modalInteraction ?? buttonInteraction;
  await safeEdit({
    interaction: replyInteraction,
    editOptions: {
      components: [await containerHelper(switchContainer, user, avatar, { buttons: true })],
    },
  });

  if (modalInteraction) await reply.delete();
  let content;
  switch (cID) {
    case "back": {
      await safeEdit({ interaction, editOptions: { components: [container] } });
      break;
    }
    case "check": {
      console.debug("A");
      const levelData = safeStringify(levels);
      const rewardsData = safeStringify(rewards);
      const checkContainer = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## This is what we’ll import from ${bots.name}\n**Levels**:${
            levelData.length <= 2048
              ? codeBlock("yaml", levelData)
              : "The level data is an attachment due to it being too large."
          }${
            rewards
              ? `\n**Rewards**:\n${
                  rewardsData.length <= 2048
                    ? codeBlock("yaml", rewardsData)
                    : "The rewards are an attachment due to them being too large."
                }`
              : ""
          }`,
        ),
      );

      console.debug("B");

      const files: AttachmentBuilder[] = [];
      if (levelData.length > 2048) {
        files.push(new AttachmentBuilder(Buffer.from(levelData, "utf8"), { name: "levels.yaml" }));
        checkContainer.addFileComponents(new FileBuilder().setURL("attachment://levels.yaml"));
      }
      if (rewardsData.length > 2048) {
        files.push(
          new AttachmentBuilder(Buffer.from(rewardsData, "utf8"), { name: "rewards.yaml" }),
        );
        checkContainer.addFileComponents(new FileBuilder().setURL("attachment://rewards.yaml"));
      }

      console.debug("C");

      await safeEdit({
        interaction: buttonInteraction,
        editOptions: {
          components: [
            await containerHelper(checkContainer, user, avatar, { buttons: true, yaml: true }),
          ],
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
      await safeEdit({
        interaction: buttonInteraction,
        editOptions: {
          components: [await containerHelper(new ContainerBuilder(), user, avatar, { content })],
        },
      });

      const res = await importLevels(guild, levels, cID);

      content = `## Done!\n${res.join("\n")}`;
      await safeEdit({
        interaction: buttonInteraction,
        editOptions: {
          components: [await containerHelper(new ContainerBuilder(), user, avatar, { content })],
        },
      });
    }
  }
}

const bots: { content: string; id: keyof typeof Supported; userID: string }[] = [
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
    content: "🟠  •  Lurkr\n-# Import from [Lurkr](https://lurkr.gg/)",
    id: "LURKR",
    userID: "506186003816513538",
  },
  {
    content: "🟡  •  Amari\n-# Import from [Amari](https://amaribot.com/)",
    id: "AMARI",
    userID: "339254240012664832",
  },
];

const containerComponents = Array.from(bots, bot => {
  return new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(bot.content))
    .setButtonAccessory(
      new ButtonBuilder().setCustomId(bot.id).setLabel("Import").setStyle(ButtonStyle.Primary),
    );
});

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);
  const user = interaction.client.user;
  const avatar = user.displayAvatarURL();

  const container = new ContainerBuilder().addSectionComponents(containerComponents);
  const reply = await safeReply({
    interaction,
    replyOptions: {
      components: [await containerHelper(container, user, avatar, {})],
      flags: ["Ephemeral", "IsComponentsV2"],
    },
  });

  if (!reply) {
    await collapse("For some reason, a reply wasn’t sent your way.", interaction);
    return;
  }

  const collector = reply?.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await isButtonErrory({ i: buttonInteraction, interaction, reply })) return;

    collector.resetTimer({ time: COLLECTOR_DURATION });
    const cID = buttonInteraction.customId;
    if (cID === "please") return;

    if (cID === "MEE6") {
      await construct(
        user,
        avatar,
        interaction.guild,
        cID,
        container,
        interaction,
        buttonInteraction,
        reply,
      );
      return;
    }

    if (!["TATSU", "AMARI", "LURKR"].includes(cID)) return;

    const modal = new ModalBuilder()
      .setCustomId(cID)
      .setTitle(`•  API key to import`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Value")
          .setDescription(
            `You should have an API key from ${cID}. Don’t know how to get it? Check /help.`,
          )
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("setting")
              .setPlaceholder("Type in the value")
              .setMaxLength(MAX_INPUT_CHARS)
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          ),
      );

    await buttonInteraction.showModal(modal);
    const modalInteraction = await modalSubmit(buttonInteraction, modal, "import.ts");
    collector.resetTimer({ time: COLLECTOR_DURATION });
    if (!modalInteraction) return;

    try {
      await construct(
        user,
        avatar,
        interaction.guild,
        cID,
        container,
        interaction,
        buttonInteraction,
        reply,
        modalInteraction.fields.getTextInputValue("setting"),
        cID as keyof typeof SupportedAndRewarded,
        modalInteraction,
      );
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
