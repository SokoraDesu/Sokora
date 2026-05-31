// [TODO] fix all errors

import { getLevelRewards } from "database/leveling";
import type { SettingSettableValue } from "database/settings";
import {
  getSetting,
  getSettingCategory,
  resetSetting,
  resetSettingCategory,
  setSetting,
  settingsDefinition,
} from "database/settings";
import type { FieldData, SingleSettingDefinition } from "database/types";
import {
  getUserSetting,
  resetUserSetting,
  setUserSetting,
  settingsDefinition as userSettingsDefinition,
} from "database/userSettings";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  codeBlock,
  ContainerBuilder,
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type MentionableSelectMenuBuilder,
  type Message,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { humanizeSettings, humanizeType } from "utils/humanizeSettings";
import { kominator } from "utils/kominator";
import { logChannel } from "utils/logChannel";
import { mention } from "utils/mention";
import { modalSubmit } from "utils/modalSubmit";
import { safeMember, safeReply } from "utils/safeThings";
import { buttonCheck } from "./errorEmbed";
// import { forceType } from "utils/types";

type Component =
  | ButtonBuilder
  | ChannelSelectMenuBuilder
  | UserSelectMenuBuilder
  | RoleSelectMenuBuilder
  | StringSelectMenuBuilder
  | MentionableSelectMenuBuilder;

type SettingSection =
  | {
      text: string;
      data: { type: string; id: string };
      component: Component;
    }
  | undefined;

async function getSettingPlease(
  id: string,
  key: string,
  setting: string,
  table: "server" | "user",
  // lazy typing hack:
): Promise<Awaited<ReturnType<typeof getSetting>> | Awaited<ReturnType<typeof getUserSetting>>> {
  return await (table == "server"
    ? getSetting(id, key, setting)
    : getUserSetting(id, key, setting));
}

async function setSettingPlease(
  id: string,
  key: string,
  setting: string,
  value: SettingSettableValue,
  table: "server" | "user",
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (table == "server") {
    if (!interaction.guild)
      throw new Error("Why is guild null if you are setting a server-table setting?");
    if ((await getSetting(id, "moderation", "events"))?.toString().includes("settings")) {
      const member = await safeMember(interaction.guild, interaction.user.id);
      const avatar = member.displayAvatarURL();
      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${dotCheck({ string: avatar, doubleSpace: true })}${member.user.username} changed ${key}.${setting}`,
          iconURL: avatar,
        })
        .addFields(
          {
            name: "📻 • **Old value**",
            value: `${await getSetting(id, key, setting)}`,
          },
          {
            name: "📱 • **New value**",
            value: `${value}`,
          },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(Date.now())
        .setColor(await colorize({ hue: Sokolors.Blue }));

      await logChannel(interaction.guild, { embeds: [embed] });
    }
    await setSetting(id, key, setting, value);
    return;
  } else {
    await setUserSetting(id, key, setting, value);
    return;
  }
}

// basic, but gets the job done
function isValueValid(value: string | undefined, type: FieldData): boolean {
  if (!value || value.trim() == "") return false;
  if ((type == "INTEGER" || type == "TEXT") && Number.isNaN(Number(value))) return false;
  return true;
}

async function constructModalContainer(
  settingText: string,
  valueText: string,
  hue: number,
): Promise<ContainerBuilder> {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(settingText))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(valueText))
    .setAccentColor(await colorize({ hue }));
}

// Build and send the setting embed
export async function settingsEmbed(
  interaction: ChatInputCommandInteraction,
  table: "server" | "user",
): Promise<ContainerBuilder | undefined> {
  const guild = interaction.guild;
  if (!guild) return;
  const user = interaction.user;
  const id = table == "server" ? guild.id : user.id;
  const key = interaction.options.getSubcommand();
  const settingsDef = table == "server" ? settingsDefinition[key] : userSettingsDefinition[key];
  const exemptButtons = [
    "reset_start",
    "reset_category",
    "cancel",
    "reset_yes",
    "reset_no",
    "return",
    "add",
  ];
  const color = await colorize({ hue: Sokolors.Blue });
  let settingsObject = settingsDef.settings;
  let settingName = "";
  let reset = false;
  let confirm = false;
  let resetCategory = false;
  let disableCategory = false;
  let itrObjectView = false;
  let objectView = false;
  let disabled = false;
  let preconditionReply: (() => Promise<Message | InteractionResponse>) | null = null;

  // Create a container
  async function construct(
    settingsObject_:
      | Record<string, SingleSettingDefinition>
      | Record<string, SingleSettingDefinition>[]
      | null,
    container: ContainerBuilder,
    reset: boolean,
    buttons: ActionRowBuilder<MessageActionRowComponentBuilder>[],
    objectView_?: boolean,
    itrObjectView_?: boolean,
    cID?: string,
    disabled?: boolean,
  ): Promise<ContainerBuilder | undefined> {
    if (objectView_ || itrObjectView_)
      container
        .addActionRowComponents(
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(objectView_ ? "cancel" : "return")
              .setLabel(objectView_ ? "Cancel" : "Return")
              .setStyle(ButtonStyle.Secondary),
          ),
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (itrObjectView_)
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# idfk what to say here yet"),
      );

    if (!settingsObject_) return;

    // Construct a single setting row (title + action)
    function constructLoop(object: SettingSection): void {
      if (!object) return;
      const component = object.component;

      if (object.data.id == cID && object.data.type == "reset") component.setDisabled(true);
      if (component instanceof ButtonBuilder)
        container.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(object.text))
            .setButtonAccessory(component.setDisabled(disabled ?? false)),
        );
      else
        container
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(object.text))
          .addActionRowComponents(
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              component.setDisabled(disabled ?? false),
            ),
          );
    }

    // [TODO] rework this to not spam 130loc settingComponent all the time
    if (itrObjectView_)
      for (const object of settingsObject_ as Record<string, unknown>[])
        constructLoop(
          await settingComponent({
            settingsObj: settingsObject_,
            name: `lvl${object.level}`,
            reset,
            itrObjectView: itrObjectView_,
          }),
        );
    else
      // Temporary (only fixed to level rewards for now)
      for (const name of Object.keys(settingsObject_))
        constructLoop(await settingComponent({ settingsObj: settingsObject_, name, reset }));

    // empty separator.
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));

    // Bottom description button (disabled) + reset
    if (table == "server") container.addActionRowComponents(buttons);
    else
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(settingsDef.description),
      );
  }

  // Build a single setting row
  const settingComponent = async (options: {
    settingsObj:
      | Record<string, SingleSettingDefinition>
      | Record<string, SingleSettingDefinition>[];
    name: string;
    reset: boolean;
    objectView?: boolean;
    itrObjectView?: boolean;
  }): Promise<
    | {
        text: string;
        data: {
          type: string;
          id: string;
        };
        component:
          | ButtonBuilder
          | ChannelSelectMenuBuilder
          | UserSelectMenuBuilder
          | RoleSelectMenuBuilder
          | StringSelectMenuBuilder;
      }
    | undefined
  > => {
    const { settingsObj, name, reset, itrObjectView } = options;
    if (exemptButtons.includes(name) || exemptButtons.map(name => `obj${name}`).includes(name))
      return;

    let data: { type: string; id: string };
    let component: Component;
    let text: string;

    // Setting reset/delete builder
    const resetObject = (
      text: string,
      itrObject?: boolean,
    ): {
      text: string;
      data: {
        type: string;
        id: string;
      };
      component: ButtonBuilder;
    } => {
      data = { type: "reset", id: name };
      component = new ButtonBuilder()
        .setCustomId(data.id)
        .setLabel(itrObject ? "Delete" : "Reset")
        .setStyle(ButtonStyle.Danger);

      if (!itrObject && (settingObject?.val == setting || settingObject?.type == "OBJECT"))
        component.setDisabled(true); // Temporary (will be able to reset an object type when it works later)

      return { text, data, component };
    };

    if (itrObjectView) {
      // Only for leveling for now
      const reward = (await getLevelRewards(id))?.find(r => name.includes(r.level.toString()));
      if (!reward) return;
      text = `Level **${reward?.level}**\n-# Rewards • ${mention(reward?.id, reward?.channel ? "CHANNEL" : "ROLE")}`;
      data = { type: "lvl", id: name };
      component = new ButtonBuilder()
        .setCustomId(data.id)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Secondary);

      if (reset) return resetObject(text, true);
      return { text, data, component };
    }

    const typedSetting = (settingsObj as Record<string, SingleSettingDefinition>)[name];
    let settingObject:
      | SingleSettingDefinition
      | (SingleSettingDefinition & { type: "OBJECT" })["settings"] = typedSetting;

    if (typedSetting.type === "OBJECT")
      switch (name) {
        /*case "rewards": {
          const levelRewards = await getLevelRewards(id);
          settingObject = levelRewards?.toSorted(
            (reward1, reward2) => reward1.level - reward2.level,
          );
          break;
        }*/
        default: {
          settingObject = typedSetting.settings;
          break;
        }
      }

    settingObject ??= typedSetting;

    // [TODO] make this support objectView (currently outputs an error)
    const setting = await getSettingPlease(id, key, name, table);
    // 25 is the maximum amount of things a single select menu can store.
    const maxValues = settingObject.iterable ? 25 : 1;
    text = `${dotCheck({ string: settingObject.emoji as string, doubleSpace: true, twoSides: true, includeString: true })}${humanizeSettings(name)}\n-# ${typeof settingObject.desc == "string" ? settingObject.desc : JSON.stringify(settingObject.desc)}`;

    if (reset) return resetObject(text, false);

    data = { type: settingObject.type as string, id: name };
    component = new ButtonBuilder()
      .setCustomId(data.id)
      .setLabel("Edit")
      .setStyle(ButtonStyle.Secondary);

    // Commented for now cuz idk if it can cause problems with the soon-to-exist implementation of OBJECT
    // if (!forceType<SingleSettingDefinition>(settingObject)) return;
    switch (settingObject.type) {
      case "BOOL": {
        component = component
          .setLabel(humanizeSettings(setting?.toString() ?? "Not set"))
          .setStyle(setting ? ButtonStyle.Success : ButtonStyle.Danger);

        break;
      }
      case "CHANNEL": {
        component = new ChannelSelectMenuBuilder()
          .setCustomId(data.id)
          .setMaxValues(maxValues)
          .setChannelTypes([
            ChannelType.GuildAnnouncement,
            ChannelType.GuildStageVoice,
            ChannelType.GuildText,
            ChannelType.GuildVoice,
          ])
          .setDefaultChannels(kominator(setting as string));

        if (setting) component.setDefaultChannels(kominator(setting as string));
        break;
      }
      case "USER": {
        component = new UserSelectMenuBuilder()
          .setCustomId(data.id)
          .setMaxValues(maxValues)
          .setDefaultUsers(kominator(setting as string));

        if (setting) component.setDefaultUsers(kominator(setting as string));
        break;
      }
      case "ROLE": {
        component = new RoleSelectMenuBuilder()
          .setCustomId(data.id)
          .setMaxValues(maxValues)
          .setDefaultRoles(kominator(setting as string));

        break;
      }
      case "SELECT": {
        const options = settingObject.choices;
        component = new StringSelectMenuBuilder()
          .setCustomId(data.id)
          .setMaxValues(options.length)
          .setOptions(
            options.map((option: string) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(option)
                .setValue(option)
                .setDefault(kominator((setting as string | undefined) ?? "").includes(option)),
            ),
          );
        break;
      }
      case "OBJECT": {
        component = component.setLabel("suffer").setStyle(ButtonStyle.Danger);
        break;
      }
      case "REWARD": {
        component = new RoleSelectMenuBuilder().setCustomId(data.id);
      }
      // [TODO] either implement two select menus, or
      // make a custom string select menu with channels and roles
    }

    if (settingsDef.settings[name]) {
      // Doesn't happen when adding/editing a value in an OBJECT type btw
      const precondError =
        settingsDef.settings[name].precondition &&
        (await settingsDef.settings[name].precondition(interaction, setting));

      if (precondError) {
        if (table == "server") await resetSetting(id, key, name);
        else if (table == "user") await resetUserSetting(id, name, name);
        text = `${dotCheck({ string: ":warning:", doubleSpace: true, twoSides: true, includeString: true })}${humanizeSettings(name)}\n-# ${precondError}`;
        component.setDisabled(true);
        preconditionReply = async (): Promise<Message | InteractionResponse> =>
          await safeReply({
            interaction: interaction,
            replyOptions: {
              components: [
                await constructModalContainer(
                  `**${dotCheck({ string: settingsDef.settings[name].emoji, twoSides: true, includeString: true })}${humanizeSettings(name)}** couldn't be changed!`,
                  precondError,
                  Sokolors.Red,
                ),
              ],
              flags: ["Ephemeral", "IsComponentsV2"],
            },
          });
      }
    }

    return { text, data, component };
  };

  // Bottom button row builder
  const buttons = async (
    reset: boolean,
    confirm: boolean,
    cID?: string,
    disableCategory?: boolean,
    itrObjectView_?: boolean,
    disabled?: boolean,
  ): Promise<[ActionRowBuilder<MessageActionRowComponentBuilder>]> => {
    const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    const category = new ButtonBuilder()
      .setCustomId("reset_category")
      .setLabel("Reset category")
      .setStyle(ButtonStyle.Danger);

    if (confirm) {
      if (!itrObjectView_) category.setDisabled(disableCategory);
      return [
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId("reset_confirm")
            .setLabel(`Reset ${cID == "reset_category" ? "the category" : cID}?`)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled ?? false),
          new ButtonBuilder()
            .setCustomId("reset_yes")
            .setLabel("Yes")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled ?? false),
          new ButtonBuilder()
            .setCustomId("reset_no")
            .setLabel("No")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled ?? false),
        ),
      ];
    }

    if (reset) {
      if (!itrObjectView_) actionRow.addComponents(category);
      return [
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId("cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled ?? false),
        ),
      ];
    }

    const buttonArray = itrObjectView_
      ? []
      : [
          new ButtonBuilder()
            .setCustomId("desc")
            .setLabel(itrObjectView_ ? settingsObject.rewards.desc : settingsDef.description)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        ];

    const actual = (await getSettingCategory(id, key)).map(setting => setting ?? null);
    const defaults = Object.values(settingsObject).map(setting => setting.val ?? null);
    const nullCheck = itrObjectView_
      ? !(await getLevelRewards(id))?.every(value => value == null)
      : JSON.stringify(actual) !== JSON.stringify(defaults);

    if (nullCheck)
      buttonArray.unshift(
        new ButtonBuilder()
          .setCustomId("reset_start")
          .setLabel(itrObjectView_ ? "Delete" : "Reset")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled ?? false),
      );

    // [TODO] make buttons for when you're adding a new object
    if (itrObjectView_)
      buttonArray.unshift(
        new ButtonBuilder()
          .setCustomId("objadd")
          .setLabel("Add")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled ?? false),
      );

    return [actionRow.addComponents(buttonArray)];
  };

  const container = new ContainerBuilder().setAccentColor(color);
  await construct(settingsObject, container, false, await buttons(false, false));
  const reply = await safeReply({
    interaction: interaction,
    replyOptions: {
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"],
    },
  });

  if (preconditionReply != null) await preconditionReply();
  const collector = reply.createMessageComponentCollector({ time: 60_000 });

  collector.on("collect", async (selectInteraction: AnySelectMenuInteraction) => {
    if (await buttonCheck({ i: selectInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    const cID = selectInteraction.customId;

    // Special buttons (navigation)
    switch (cID.replace("obj", "")) {
      case "reset_start": {
        reset = true;
        confirm = false;
        break;
      }
      case "reset_category": {
        reset = true;
        confirm = true;
        disableCategory = true;
        resetCategory = true;
        break;
      }
      case "reset_yes": {
        await (resetCategory
          ? resetSettingCategory(id, key)
          : setSettingPlease(id, key, settingName, null, table, interaction));
        reset = false;
        confirm = false;
        break;
      }
      case "reset_no": {
        reset = true;
        confirm = false;
        break;
      }
      case "cancel": {
        reset = false;
        confirm = false;
        if (objectView) {
          objectView = false;
          settingsObject = settingsDef.settings;
          itrObjectView = true;
        }
        break;
      }
      case "return": {
        itrObjectView = false;
        break;
      }
      case "add": {
        itrObjectView = false;
        objectView = true;
        break;
      }
    }

    // Settings buttons
    const componentType = (
      await settingComponent({ settingsObj: settingsObject, name: cID, reset: reset })
    )?.data.type.toLowerCase();
    switch (componentType) {
      case "reset": {
        reset = true;
        confirm = true;
        settingName = cID;
        break;
      }
      case "bool": {
        await setSettingPlease(
          id,
          key,
          cID,
          !(await getSettingPlease(id, key, cID, table)),
          table,
          interaction,
        );
        break;
      }
      case "object": {
        itrObjectView = true;
        break;
      }
      case "lvl": {
        itrObjectView = false;
        objectView = true;
        break;
      }
      case "integer":
      case "text": {
        const modal = new ModalBuilder()
          .setCustomId(cID)
          .setTitle(`•  ${humanizeSettings(cID)}`)
          .addLabelComponents(
            new LabelBuilder().setLabel("Value").setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("setting")
                .setPlaceholder("Type in the value")
                .setMaxLength(4000)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setValue(`${await getSettingPlease(id, key, cID, table)}`),
            ),
          );

        await selectInteraction.showModal(modal);
        const modalInteraction = await modalSubmit(selectInteraction);

        // After modal interaction
        collector.resetTimer({ time: 60_000 });
        if (!modalInteraction) return;

        const value = modalInteraction.fields.getTextInputValue("setting");
        const length = value.length;
        let settingText = `**${dotCheck({ string: settingsObject[cID].emoji, twoSides: true, includeString: true })}${humanizeSettings(cID)}** got changed`;
        let valueText = `The ${value.length < 50 ? "value" : "**value**"} has been set ${length >= 500 ? "successfully." : (length >= 50 ? `to ${value}` : `to **${value}**`)}`;
        let hue = Sokolors.Blue;

        if (isValueValid(value, settingsObject[cID].type))
          await setSettingPlease(id, key, cID, value, table, interaction);
        else {
          settingText = `**${dotCheck({ string: settingsObject[cID].emoji, twoSides: true, includeString: true })}${humanizeSettings(cID)}** couldn't be changed!`;
          valueText = `Given data is invalid. Ensure it's of the valid type (${humanizeType(settingsObject[cID].type)}) and try again.${length >= 500 ? "" : `\nData entered was:\n${codeBlock(value)}`}`;
          hue = Sokolors.Red;
        }

        await safeReply({
          interaction: modalInteraction,
          replyOptions: {
            components: [await constructModalContainer(settingText, valueText, hue)],
            flags: ["Ephemeral", "IsComponentsV2"],
          },
        });
        break;
      }
      default: {
        if (!(exemptButtons.includes(cID) ?? exemptButtons.map(id => `obj${id}`).includes(cID)))
          await setSettingPlease(id, key, cID, selectInteraction.values, table, interaction);
      }
    }

    if (objectView)
      settingsObject = (
        settingsObject.rewards as Extract<SingleSettingDefinition, { type: "OBJECT" }>
      ).settings;
    const newContainer = new ContainerBuilder().setAccentColor(color);
    const rewards = await getLevelRewards(id);
    // [TODO]: fix whatever tf this is
    await construct(
      itrObjectView
        ? (rewards?.toSorted((reward1, reward2) => reward1.level - reward2.level) ?? null)
        : settingsObject,
      newContainer,
      reset ?? confirm,
      await buttons(reset, confirm, cID, disableCategory, itrObjectView),
      objectView ?? false,
      itrObjectView ?? false,
      cID,
      disabled,
    );

    return await safeReply({
      interaction: selectInteraction,
      editOptions: { components: [newContainer] },
    });
  });

  collector.on("end", async () => {
    try {
      disabled = true;
      const newContainer = new ContainerBuilder().setAccentColor(color);
      await construct(
        itrObjectView
          ? (((await getLevelRewards(id))
              ? (await getLevelRewards(id))?.toSorted(
                  (reward1, reward2) => reward1.level - reward2.level,
                )
              : null) ?? null)
          : settingsObject,
        newContainer,
        false,
        await buttons(false, confirm, undefined, disableCategory, itrObjectView),
        objectView ?? false,
        itrObjectView ?? false,
        undefined,
        disabled,
      );

      return await safeReply({ interaction, editOptions: { components: [newContainer] } });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
