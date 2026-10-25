import {
  getCase,
  listGuildCases,
  listUserCases,
  type Case,
  type ModType,
} from "database/moderation";
import type { TypeOfDefinition } from "types";
import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type InteractionResponse,
  type Message,
  type User,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import ms from "enhanced-ms";
import { capitalize } from "utils/capitalize";
import { colorize, Sokolors } from "utils/colorize";
import { COLLECTOR_DURATION } from "utils/constants";
import { mention } from "utils/mention";
import { handlePages, pagedButtons } from "utils/pagination";
import { pluralOrNot } from "utils/pluralOrNot";
import { randomize } from "utils/randomize";
import { safeEdit, safeMember, safeUser } from "utils/safeThings";
import { isButtonErrory } from "utils/buttonCheck";

// TODO: figure out how to MVC this
// since cases are DB i think i won't make a case feature, but instead move all the filtering done here to cases model
// and keep this UI-code only

async function generateContainer(options: {
  client: Client;
  cases: TypeOfDefinition<Case>[];
  page: number;
  type: ModType | null;
  guildID: string;
  user: User | null;
  id: number | null;
  disabled: boolean;
}): Promise<ContainerBuilder> {
  const { client, cases, page, type, guildID, user, id, disabled } = options;
  const actionsEmojis: Record<ModType, string> = {
    WARN: "⚠️",
    MUTE: "🔇",
    UNMUTE: "🔊",
    KICK: "📤",
    BAN: "🔨",
    UNBAN: "🔧",
    CLEAR: "🧹",
    LOCK: "🔒",
    UNLOCK: "🔓",
    SLOWDOWN: "⏳",
  };

  const nothingMessage = [
    "Nothing to see here…",
    "Ayay, no cases on this horizon cap’n!",
    "Clean as a whistle!",
    "0 + 0 = ?",
  ];

  const casesPerPage = 5;
  const start = page * casesPerPage;
  const displayedCases = cases.toSorted((a, b) => b.id - a.id).slice(start, start + casesPerPage);
  let fields = await Promise.all(
    displayedCases.map(async c => {
      const value = [
        `**Moderator**: ${(await safeUser(client, c.moderator_id)).username}`,
        c.reason ? `**Reason**: ${c.reason}` : "*No reason provided*",
        `**Time of action**: ${mention(c.timestamp.valueOf(), "SIMPLE_TIMESTAMP")}`,
      ];
      let title = `**${actionsEmojis[c.type as ModType]} • ${capitalize(c.type.toLowerCase())} #${c.id}**`;

      if (!user) title += ` • ${await safeUser(client, c.user_id)}`;
      if (c.expires_at) value.push(`**Duration**: ${ms(Number(c.expires_at), "fullPrecision")}`);

      return new TextDisplayBuilder().setContent([title, value.join("\n")].join("\n"));
    }),
  );

  if (cases.length === 0)
    fields = [
      new TextDisplayBuilder().setContent(
        [
          `**💨 • ${randomize(nothingMessage)}**`,
          type
            ? `*No ${type.toLowerCase()}s were made in the entire server!*`
            : "*No actions were taken in the entire server. How clean!*",
        ].join("\n"),
      ),
    ];

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${id ? capitalize(displayedCases[0].type?.toLowerCase()) : type ? `${capitalize(type.toLowerCase())} cases` : pluralOrNot("Case", cases.length)} ${id ? `#${id}` : user ? `of ${user.username}` : "in the server"}`,
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  container.addTextDisplayComponents(id ? [fields[0]] : fields);

  const pages = Math.ceil(cases.length / 5);
  if (pages > 1) container.addActionRowComponents(pagedButtons(pages, page, disabled));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      user ? `-# User ID: ${user.id} • Server ID: ${guildID}` : `-# Server ID: ${guildID}`,
    ),
  );

  return container;
}

export const data = new SlashCommandSubcommandBuilder()
  .setName("cases")
  .setDescription("Lists all cases of a user (or in a server).")
  .addUserOption(user =>
    user.setName("user").setDescription("The user’s cases that you want to see."),
  )
  .addNumberOption(number =>
    number.setName("id").setDescription("The ID of a specific case that you want to see."),
  )
  .addStringOption(string => {
    return string
      .setName("type")
      .setDescription("The specific type of action you’d like to see.")
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
      );
  })
  .addNumberOption(option => option.setName("page").setDescription("Page number to display."));

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<undefined | InteractionResponse | Message> {
  const guild = interaction.guild;
  if (!guild) return;
  if (!(await safeMember(guild, interaction.user.id)).permissions.has("ModerateMembers"))
    return await errorEmbed(false, {
      interaction,
      title: "You can’t execute this command.",
      reason: "You need the **Moderate Members** permission.",
    });

  const client = interaction.client;
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
    components: [
      await generateContainer({
        client,
        cases,
        page,
        guildID,
        type: modType,
        user,
        id: actionID,
        disabled: false,
      }),
    ],
    flags: ["Ephemeral", "IsComponentsV2"],
  });

  if (pages <= 1) return;
  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await isButtonErrory({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: COLLECTOR_DURATION });
    if (buttonInteraction.customId == "please") return;

    page = await handlePages({ i: buttonInteraction, page, pages, collector });
    await safeEdit({
      interaction: buttonInteraction,
      editOptions: {
        components: [
          await generateContainer({
            client,
            cases,
            page,
            guildID,
            type: modType,
            user,
            id: actionID,
            disabled: false,
          }),
        ],
      },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({
        components: [
          await generateContainer({
            client,
            cases,
            page,
            guildID,
            type: modType,
            user,
            id: actionID,
            disabled: true,
          }),
        ],
      });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
