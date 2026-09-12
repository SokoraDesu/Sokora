import {
  ActionRowBuilder,
  type AnySelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION, MAX_INPUT_CHARS } from "utils/constants";
import { modalSubmit } from "utils/modalSubmit";
import { safeCustomId, safeEdit, safeReply } from "utils/safeThings";

async function getContainers(
  isPreviewBool: boolean,
  previewArraySelected: string[],
): Promise<ContainerBuilder[]> {
  const firstContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## The /settings command"),
      new TextDisplayBuilder().setContent(
        'Sokora’s settings menu (formally called "**Peak Settings Editor**", or **PSE**) can be confusing at first, since instead of taking command arguments or redirecting to a web dashboard, it shows a container with the current settings and a ton of toggles. This container is interactive and is the way you’re supposed to edit settings (faster and easier!)',
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const basicUseContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 🔰 • PSE at a basic level"),
      new TextDisplayBuilder().setContent(
        [
          "Most settings should be clear to understand.",
          "- Boolean settings (like `Enabled` in certain categories) appear as a button that shows *current* status. Clicking it inverts it (i.e. disables what is enabled and vice versa).",
          "- Channel, role or select settings show a Discord-native select menu.",
          '- Text or numeric settings wield an "Edit" button, hitting it opens a Modal where you can see the current value and overwrite it if you wish.\n',
          "**Below is an interactive demo.**",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Title of setting 1\n-# Description of setting 1"),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId("preview_bool")
            .setLabel(isPreviewBool.toString())
            .setStyle(isPreviewBool ? ButtonStyle.Success : ButtonStyle.Danger),
        ),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Title of setting 2\n-# Guess"))
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
        new StringSelectMenuBuilder()
          .setCustomId("preview_select")
          .setMaxValues(3)
          .setOptions(
            ["Open me…", "Look at me!", "Cool select, right?"].map((option: string) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(option)
                .setValue(option)
                .setDefault(previewArraySelected.includes(option)),
            ),
          ),
      ),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "Title of setting 3\n-# You guessed it! Description of setting 3",
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId("preview_text")
            .setLabel("Edit")
            .setStyle(ButtonStyle.Secondary),
        ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "**Changes apply instantly whenever you touch something.** If you fear accidental changes, enable settings logging via `/settings moderation` so you have a history of changes.",
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const objectContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 🗃️ • OBJECT-type settings"),
      new TextDisplayBuilder().setContent(
        [
          'Some settings (so-called OBJECTS) are nested. They wield an "Open" button instead of an "Edit" one, after which two things can be found depending on whether it is a "static object" (merely an object) or an "iterable object" (a list of multiple objects):',
          '- For _static objects_: A view similar to that of PSE, but with the specific settings of the OBJECT (an "object view").',
          '- For _iterable objects_: A list ("iterable view"; or a message telling you the list is empty), with entries wielding another "Open" button that takes you to this object’s object view.\n',
          "*These are a bit more complex to give you an interactive example*,\nso we’ll instead rely on **the screenshots below.**",
        ].join("\n"),
      ),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setDescription("Screenshot of a PSE iterable view (the one for leveling.rewards)")
          .setURL("https://sokora.org/bot_assets/help_obj__itr_view.png"),
      ),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setDescription("Screenshot of a PSE object view")
          .setURL("https://sokora.org/bot_assets/help_obj__obj_view.png"),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          'Unlike regular PSE views, object views have a "Save" button to apply changes. Other than that, object views behave nearly the same.',
          "Iterable objects give you a list where each entry is given a label specific to the setting (e.g., `leveling.rewards` shows the level, channels and roles of each object in the main label). A tinier label below shows lesser important (but useful for power users) information: object index in the list and its GUID. These two don’t have a use-case yet but will have one in future releases.",
          "The way they’re sorted is also setting-dependant (e.g., `leveling.rewards` sorts by level).",
        ].join("\n\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const resetContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 🔄 • Resetting or deleting data"),
      new TextDisplayBuilder().setContent(
        [
          'There’s a "Reset" button that shows up at the bottom of every PSE view whenever a setting has diverged from its default value. Clicking it opens a _resetting view_ where all changed settings have a "Select" button to their right.',
          'Selecting a setting marks it for reset whenever you click the "Proceed with selected" button below. Next to it there’s also a "Reset all" button to just wipe the entire category, and a button to go back.',
          'Iterable views instead only have a "Clear" button that directly deletes every object within the iterable. Open objects to delete them individually.',
          "In all cases, **hitting reset will show a confirmation dialog to double-check** if you really want to reset anything.",
        ].join("\n\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const loggingContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 📥 • Settings logging"),
      new TextDisplayBuilder().setContent(
        [
          'From `moderation.events` (assuming `moderation.channel` is set) you can enable an event called "settings". **When enabled, any settings change will be logged to the designated channel**, allowing to check what the previous value was and optionally revert it yourself.',
          "Regular settings are logged in a simple before/after format, and using raw IDs for things like channels or roles (which is more convenient for later restoration).",
          'OBJECT settings are logged using text in a format similar to YAML, and using a "diff" where instead of showing the before and after, just one text block is shown highlighting in red what was removed and in green what was added in place.',
        ].join("\n\n"),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  return [firstContainer, basicUseContainer, objectContainer, resetContainer, loggingContainer];
}

export const data = new SlashCommandSubcommandBuilder()
  .setName("settings")
  .setDescription("Show help with how the Sokora Peak Settings Editor works.");

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  let isPreviewBool = false;
  let previewArraySelected = ["Open me…"];
  let previewText = "";

  const reply = await interaction.reply({
    components: await getContainers(isPreviewBool, previewArraySelected),
    flags: ["Ephemeral", "IsComponentsV2"],
  });
  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async replyInteraction => {
    switch (replyInteraction.customId) {
      case "preview_bool": {
        isPreviewBool = !isPreviewBool;
        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: await getContainers(isPreviewBool, previewArraySelected),
          },
        });

        break;
      }
      case "preview_select": {
        previewArraySelected = [...(replyInteraction as AnySelectMenuInteraction).values];
        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: await getContainers(isPreviewBool, previewArraySelected),
          },
        });

        break;
      }
      case "preview_text": {
        const modal = new ModalBuilder()
          .setCustomId(safeCustomId("modal_test"))
          .setTitle("•  Change the setting!")
          .addLabelComponents(
            new LabelBuilder().setLabel("Value").setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("setting")
                .setPlaceholder("Type in the value")
                .setMaxLength(MAX_INPUT_CHARS)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setValue((previewText as string | number | undefined)?.toString() ?? ""),
            ),
          );

        const modalInteraction = await modalSubmit(replyInteraction, modal, "help/settings");
        if (modalInteraction) {
          previewText = modalInteraction.fields.getTextInputValue("setting");
          await safeReply({
            interaction: modalInteraction,
            replyOptions: {
              content:
                "Changed the value! Click ’Edit’ again to see if it saved or not.\n-# Note that real PSE will be more descriptive and validate the data.",
              flags: ["Ephemeral"],
            },
          });
          await safeEdit({
            interaction: replyInteraction,
            editOptions: {
              components: await getContainers(isPreviewBool, previewArraySelected),
            },
          });
        }

        break;
      }
      // No default
    }
  });

  collector.on("end", async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
