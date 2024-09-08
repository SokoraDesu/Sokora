import {
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandSubcommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import { genColor } from "../../utils/colorGen";
import { getModeration, listUserModeration } from "../../utils/database/moderation";
import { errorEmbed } from "../../utils/embeds/errorEmbed";

const actionsEmojis = {
  WARN: "⚠️",
  MUTE: "🔇",
  KICK: "🦶",
  BAN: "🔨"
};

export default class History {
  data: SlashCommandSubcommandBuilder;
  constructor() {
    this.data = new SlashCommandSubcommandBuilder()
      .setName("history")
      .setDescription("Moderation actions history of a user.") // Can be misundertood as the user's history, needs changing
      .addUserOption(user =>
        user.setName("user").setDescription("The user that you want to see.").setRequired(true)
      )
      .addStringOption(string =>
        string.setName("id").setDescription("The ID of a specific moderation action you want to see.")
      );
  }

  async run(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    if (
      !guild.members.cache
        .get(interaction.user.id)
        ?.permissions.has(PermissionsBitField.Flags.ModerateMembers)
    )
      return await errorEmbed(
        interaction,
        "You can't execute this command.",
        "You need the **Moderate Members** permission."
      );

    const user = interaction.options.getUser("user")!;
    // const warns = listUserModeration(guild.id, user.id, "WARN");
    // const mutes = listUserModeration(guild.id, user.id, "MUTE");
    // const kicks = listUserModeration(guild.id, user.id, "KICK");
    // const bans = listUserModeration(guild.id, user.id, "BAN");
    const actionid = interaction.options.getString("id")
    const allactions = actionid ? getModeration(guild.id, actionid) : listUserModeration(guild.id, user.id);
    const embed = new EmbedBuilder()
      .setAuthor({ name: `•  ${user.displayName}`, iconURL: user.displayAvatarURL() })
      .setDescription(`Moderation actions history of ${user.displayName}.`)
      .setTitle(`Mod Action history of ${user.displayName}.`)
      .setFields(
        allactions.length > 0
          ? allactions.map(action => {
              return {
                name: `${actionsEmojis[action.type]} ${action.type} #${action.id}`,
                value: [
                  `- __Moderator__: <@${action.moderator}>`,
                  `- __Reason__: ${action.reason}`,
                  `- __Date__: <t:${Math.floor(action.timestamp / 1000)}:f>`
                ].join("\n")
              };
            })
          : [{ name: "No actions", value: "No action has been taken on this user" }]
      )
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `User ID: ${user.id}` })
      .setColor(genColor(100));

    await interaction.reply({ embeds: [embed] });
  }
}
