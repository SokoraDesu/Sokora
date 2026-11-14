import {
  type TS,
  getSetting,
  getSettingDef,
  serverSettingsKeys,
  setSetting,
  settingsDefinition,
} from "database/settings";
import type { SettingKeyFor, SettingReturnType } from "types";
import {
  type ChatInputCommandInteraction,
  type Guild,
  type User,
  codeBlock,
  ContainerBuilder,
  InteractionContextType,
  PermissionsBitField,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { settingsEmbed } from "embeds/settingsEmbed";
import gitDiff from "git-diff";
import { colorize, Sokolors } from "utils/colorize";
import { logChannel } from "utils/logChannel";
import { mention } from "utils/mention";
import { safeMember } from "utils/safeThings";
import { assertInteraction } from "types";

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure Sokora to your liking.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .setContexts(InteractionContextType.Guild);

for (const key of serverSettingsKeys)
  data.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(key)
      .setDescription(settingsDefinition[key].description),
  );

async function setSettingPlease<K extends keyof TS, S extends SettingKeyFor<K>>(
  interaction: ChatInputCommandInteraction & { guild: Guild; guildId: string; user: User },
  key: K,
  setting: S,
  value: SettingReturnType<K, S>,
): Promise<void> {
  if ((await getSetting(interaction.guild.id, "moderation", "events"))?.includes("settings")) {
    const member = await safeMember(interaction.guild, interaction.user.id);
    const previousValue = await getSetting(interaction.guild.id, key, setting);
    const def = getSettingDef(key, setting);
    const fmt = (value_: unknown): string => {
      return def.type === "OBJECT" && def.iterable
        ? Bun.YAML.stringify(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (value_ as { $: string }[]).map(({ $, ...rest }) => rest),
            null,
            2,
          )
        : Bun.YAML.stringify(value_, null, 2);
    };

    const oldString =
      previousValue === undefined || previousValue === null
        ? "[Setting was previously unset]"
        : fmt(previousValue);

    const newString =
      value === undefined || previousValue === null
        ? "[Setting value was deleted, it is now unset]"
        : fmt(value);

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${member.user.username} changed ${key}.${setting}**`),
    );

    if (def.type === "OBJECT") {
      const diff: string | undefined = gitDiff(
        oldString
          .split("\n")
          .map(l => l.replace("-", "•"))
          .join("\n"),
        newString
          .split("\n")
          .map(l => l.replace("-", "•"))
          .join("\n"),
      );

      if (!diff) return;
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            codeBlock("diff", diff),
            "-# Where red lines (starting with a `-`) are the previous value,\n-# and green lines (starting with a `+`) are the new value.",
          ].join("\n"),
        ),
      );
    } else {
      const oldValueString = `☎️ • **Old value**${oldString.includes("\n") ? `\n${codeBlock("yaml", oldString)}` : ` • \`${oldString}\``}`;
      const newValueString = `📱 • **New value**${newString.includes("\n") ? `\n${codeBlock("yaml", newString)}` : ` • \`${newString}\``}`;

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${oldValueString}\n${newValueString}`),
      );
    }

    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# User ID: ${member.id} • ${mention(Date.now(), "DETAILED_TIMESTAMP")}`,
        ),
      )
      .setAccentColor(await colorize({ hue: Sokolors.Blue }));

    await logChannel(interaction.guild, { components: [container], flags: "IsComponentsV2" });
  }
  await setSetting(interaction.guild.id, key, setting, value);
  return;
}

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  const key = interaction.options.getSubcommand() as keyof TS;
  await settingsEmbed(interaction, key, {
    setSettingPlease: async (key, setting, value) => {
      await setSettingPlease(interaction, key, setting, value);
    },
    getSettingPlease: async (key, setting) => await getSetting(interaction.guild.id, key, setting),
  });
}
