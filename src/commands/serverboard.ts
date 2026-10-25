import { fetchServerboard, type ServerboardEntry } from "database/serverboard";
import {
  InteractionContextType,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ContainerBuilder,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import { serverEmbed } from "embeds/serverEmbed";
import { isButtonErrory } from "utils/buttonCheck";
import { COLLECTOR_DURATION } from "utils/constants";
import { handlePages } from "utils/pagination";
import { safeEdit } from "utils/safeThings";

export const data = new SlashCommandBuilder()
  .setName("serverboard")
  .setDescription("Shows the servers that have Sokora.")
  .addNumberOption(number => number.setName("page").setDescription("The page you want to see."))
  .setContexts(InteractionContextType.Guild);

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  let guildList: ServerboardEntry[];
  try {
    guildList = await fetchServerboard(interaction.client);
  } catch (error) {
    return await errorEmbed(true, {
      interaction,
      error,
      title: "Serverboard error.",
      fileName: "serverboard",
    });
  }

  const pages = guildList.length;
  if (!pages) {
    return await errorEmbed(false, {
      interaction,
      title: "No public server found.",
      reason:
        "By some magical miracle, all the servers using Sokora turned off their visibility. Use /settings serverboard `shown: True` to make your server publicly visible.",
    });
  }

  let page = Math.max(0, Math.min(interaction.options.getNumber("page") ?? 0, pages) - 1);
  async function getContainer(shouldDisableButtons?: boolean): Promise<ContainerBuilder> {
    return await serverEmbed({
      guild: guildList[page].guild,
      invite: {
        show: guildList[page].showInvite,
        channel: guildList[page].inviteChannelId,
      },
      page,
      pages,
      roles: false,
      shouldDisableButtons,
    });
  }

  const reply = await interaction.reply({
    components: [await getContainer(false)],
    flags: "IsComponentsV2",
  });

  if (pages == 1) return;
  const collector = reply.createMessageComponentCollector({ time: COLLECTOR_DURATION });
  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (await isButtonErrory({ i: buttonInteraction, interaction, reply })) return;
    collector.resetTimer({ time: COLLECTOR_DURATION });
    if (buttonInteraction.customId == "please") return;

    page = await handlePages({ i: buttonInteraction, page, pages, collector });
    await safeEdit({
      interaction: buttonInteraction,
      editOptions: { components: [await getContainer(false)] },
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [await getContainer(true)] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
