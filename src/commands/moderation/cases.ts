import {
  getCase,
  listGuildCases,
  listUserCases,
  type Case,
  type ModType,
} from "database/moderation";
import type { TypeOfDefinition } from "database/types";
import {
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
  type User,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import ms from "enhanced-ms";
import { client } from "src/bot";
import { capitalize } from "utils/capitalize";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { mention } from "utils/mention";
import { handlePages, pagedButtons } from "utils/pagination";
import { pluralOrNot } from "utils/pluralOrNot";
import { randomize } from "utils/randomize";
import { safeGuild, safeMember, safeReply } from "utils/safeThings";

async function generateEmbed(options: {
  cases: TypeOfDefinition<Case>[];
  page: number;
  type: ModType | null;
  guildID: string;
  user: User | null;
  id: number | null;
}): Promise<EmbedBuilder> {
  const { cases, page, type, guildID, user, id } = options;
  const actionsEmojis: Record<ModType, string> = {
    WARN: "⚠️",
    MUTE: "🔇",
    KICK: "📤",
    BAN: "🔨",
    UNBAN: "🔓",
    UNMUTE: "🔊",
  };

  const nothingMessage = [
    "Nothing to see here...",
    "Ayay, no cases on this horizon cap'n!",
    "Clean as a whistle!",
    "0 + 0 = ?",
  ];

  const casesPerPage = 5;
  const start = page * casesPerPage;
  const displayedCases = cases.toSorted((a, b) => b.id - a.id).slice(start, start + casesPerPage);
  const avatar = user ? user.avatarURL() : (await safeGuild(client, guildID))?.iconURL();
  let fields = displayedCases.map(c => {
    const value = [
      `**Moderator**: ${mention(c.moderator, "USER")}`,
      c.reason ? `**Reason**: ${c.reason}` : "*No reason provided*",
      `**Time of action**: ${mention(c.timestamp.valueOf(), "SIMPLE_TIMESTAMP")}`,
    ];

    if (!user) value.unshift(`**User**: ${mention(c.userID, "USER")}`);
    if (c.expiresAt) value.push(`**Duration**: ${ms(Number(c.expiresAt), "fullPrecision")}`);

    return {
      name: `${actionsEmojis[c.type as ModType]} • ${capitalize(c.type.toLowerCase())} #${c.id}`,
      value: value.join("\n"),
    };
  });

  if (cases.length === 0)
    fields = [
      {
        name: `💨 • ${randomize(nothingMessage)}`,
        value: type
          ? `*No ${type.toLowerCase()}s were made in the entire server!*`
          : "*No actions were taken in the entire server. How clean!*",
      },
    ];

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: avatar, doubleSpace: true })}${id ? capitalize(displayedCases[0].type?.toLowerCase()) : (type ? `${capitalize(type.toLowerCase())} cases` : pluralOrNot("Case", cases.length))} ${id ? `#${id}` : (user ? `of ${user.username}` : "in the server")}`,
      iconURL: avatar ?? undefined,
    })
    .setFooter({
      text: user ? `User ID: ${user.id} • Server ID: ${guildID}` : `Server ID: ${guildID}`,
    })
    .setColor(await colorize({ hue: Sokolors.Blue }));

  if (id) embed.setDescription(fields[0].value);
  else embed.setFields(fields);

  return embed;
}

export const data = new SlashCommandSubcommandBuilder()
  .setName("cases")
  .setDescription("Lists all cases of a user (or in a server).")
  .addUserOption(user =>
    user.setName("user").setDescription("The user's cases that you want to see."),
  )
  .addNumberOption(number =>
    number.setName("id").setDescription("The ID of a specific case that you want to see."),
  )
  .addStringOption(string =>
    string
      .setName("type")
      .setDescription("The specific type of action you'd like to see.")
      .setChoices(
        {
          name: "Bans",
          value: "BAN",
        },
        {
          name: "Unbans",
          value: "UNBAN",
        },
        {
          name: "Warnings",
          value: "WARN",
        },
        {
          name: "Kicks",
          value: "KICK",
        },
        {
          name: "Mutes",
          value: "MUTE",
        },
        {
          name: "Unmutes",
          value: "UNMUTE",
        },
      ),
  )
  .addNumberOption(option => option.setName("page").setDescription("Page number to display."));

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<undefined | InteractionResponse | Message> {
  const guild = interaction.guild;
  if (!guild) return;
  if (!(await safeMember(guild, interaction.user.id)).permissions.has("ModerateMembers"))
    return await errorEmbed({
      interaction,
      title: "You can't execute this command.",
      reason: "You need the **Moderate Members** permission.",
    });

  const guildID = guild.id;
  const user = interaction.options.getUser("user");
  const modType = interaction.options.getString("type") as ModType;
  const actionID = interaction.options.getNumber("id");
  let cases;

  if (actionID) cases = await getCase(guildID, actionID);
  else if (user) cases = await listUserCases(guildID, user.id, modType);
  else cases = await listGuildCases(guildID, modType);

  const pages = Math.ceil(cases.length / 5);
  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);
  const reply = await interaction.reply({
    embeds: [await generateEmbed({ cases, page, guildID, type: modType, user, id: actionID })],
    components: pages > 1 ? [pagedButtons(pages, page)] : [],
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: 60_000 });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await buttonCheck({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: 60_000 });
    page = await handlePages({ i: buttonInteraction, page, pages, collector });

    await safeReply({
      interaction: buttonInteraction,
      editOptions: {
        embeds: [await generateEmbed({ cases, page, guildID, type: modType, user, id: actionID })],
        components: [pagedButtons(pages, page)],
      },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
