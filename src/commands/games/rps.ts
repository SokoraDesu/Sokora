import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionResponse,
  type Message,
} from "discord.js";
import { buttonCheck, errorEmbed } from "embeds/errorEmbed";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { randomize } from "utils/randomize";

type RPSChoice = "rock" | "paper" | "scissors";
const rpsChoices: RPSChoice[] = ["rock", "paper", "scissors"];
const rpsEmojis: Record<RPSChoice, string> = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

export const data = new SlashCommandSubcommandBuilder()
  .setName("rps")
  .setDescription("Play rock paper scissors.")
  .addUserOption(option => option.setName("opponent").setDescription("The user to play against."));

function getWinner(choice1: RPSChoice, choice2: RPSChoice): 0 | 1 | 2 {
  if (choice1 == choice2) return 0;
  if (
    (choice1 == "rock" && choice2 == "scissors") ||
    (choice1 == "paper" && choice2 == "rock") ||
    (choice1 == "scissors" && choice2 == "paper")
  )
    return 1;

  return 2;
}

export async function run(
  interaction: ChatInputCommandInteraction,
): Promise<Message | InteractionResponse | undefined> {
  let opponent = interaction.options.getUser("opponent");
  opponent ??= interaction.client.user;
  const user = interaction.user;
  const userAvatar = user.displayAvatarURL();
  const optionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...rpsChoices.map((choice: RPSChoice) =>
      new ButtonBuilder()
        .setCustomId(`rps_${choice}`)
        .setEmoji(rpsEmojis[choice])
        .setStyle(ButtonStyle.Primary),
    ),
  );

  const baseEmbed = new EmbedBuilder()
    .setAuthor({
      name: `${dotCheck({ string: userAvatar, doubleSpace: true })}An invitation to play!`,
      iconURL: userAvatar,
    })
    .setDescription(
      opponent.bot
        ? "Choose your weapon!"
        : `${user.username} has challenged ${opponent.username} to a game!\nBoth players, make your choice!`,
    )
    .setColor(await colorize({ hue: Sokolors.Yellow }));

  if (opponent.id == user.id)
    return await errorEmbed({
      interaction,
      title: "Invalid opponent.",
      reason: "You cannot play against yourself.",
    });

  const reply = await interaction.reply({ embeds: [baseEmbed], components: [optionsRow] });
  const playerChoices = new Map<string, RPSChoice>();
  const collector = reply.createMessageComponentCollector({ time: 60_000 });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (!reply) return;
    if (await buttonCheck({ i: buttonInteraction, interaction, reply, noExecuteError: true }))
      return;

    if (buttonInteraction.user.id != opponent.id && buttonInteraction.user.id != user.id)
      return await errorEmbed({
        interaction: buttonInteraction,
        title: "You aren't participating.",
      });

    playerChoices.set(
      buttonInteraction.user.id,
      buttonInteraction.customId.split("_")[1] as RPSChoice,
    );

    if (opponent.bot) collector.stop("game-complete");
    else {
      await buttonInteraction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Choice recorded!")
            .setColor(await colorize({ hue: Sokolors.Green })),
        ],
        flags: "Ephemeral",
      });
      if (playerChoices.size == 2) collector.stop("game-complete");
    }
  });

  collector.on("end", async (_, reason) => {
    try {
      if (reason == "time")
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setAuthor({ name: "Game timed out" })
              .setDescription("The game has been canceled due to inactivity.")
              .setColor(await colorize({ hue: Sokolors.Red })),
          ],
          components: [],
        });

      const p1Choice = playerChoices.get(user.id);
      const p2Choice = opponent.bot ? randomize(rpsChoices) : playerChoices.get(opponent.id);
      if (!p1Choice || !p2Choice) return;

      const winner = getWinner(p1Choice, p2Choice);
      const avatar = winner == 1 ? userAvatar : opponent.displayAvatarURL();
      const resultEmbed = new EmbedBuilder()
        .setAuthor({
          name: `${dotCheck({ string: avatar, doubleSpace: true })}Game results`,
          iconURL: avatar,
        })
        .setDescription(
          [
            `**${user.username}** ${rpsEmojis[p1Choice]} vs ${rpsEmojis[p2Choice]} **${opponent.username}**\n`,
            {
              0: "**It's a tie!**",
              1: `**${user.username}**, you win!`,
              2: opponent.bot ? `**Sokora** wins!` : `**${opponent.username}**, you win!`,
            }[winner],
          ].join("\n"),
        )
        .setColor(
          await colorize({
            hue:
              winner == 0
                ? Sokolors.Yellow
                : (winner == 2 && opponent.bot
                  ? Sokolors.Red
                  : Sokolors.Green),
          }),
        );

      await interaction.editReply({ embeds: [resultEmbed], components: [] });
    } catch (error) {
      if (Error.isError(error) && error.message.toLowerCase().includes("unknown message")) return;
      throw error;
    }
  });
}
