import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  type User,
  type ButtonInteraction,
} from "discord.js";
import { errorEmbed } from "embeds/errorEmbed";
import type { SafeChatInteraction } from "types";
import { isButtonErrory } from "utils/buttonCheck";
import { collect } from "utils/collector";
import { colorize, Sokolors } from "utils/colorize";
import { randomize } from "utils/randomize";

type RPSChoice = "rock" | "paper" | "scissors";
const rpsChoices: RPSChoice[] = ["rock", "paper", "scissors"];
const rpsEmojis: Record<RPSChoice, string> = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

function getWinner(choice1: RPSChoice, choice2: RPSChoice): 0 | 1 | 2 {
  if (choice1 == choice2) return 0;
  return (choice1 == "rock" && choice2 == "scissors") ||
    (choice1 == "paper" && choice2 == "rock") ||
    (choice1 == "scissors" && choice2 == "paper")
    ? 1
    : 2;
}

// TODO: new feature() system doesn't really cover interaction-dependant features
export async function rps(
  interaction: SafeChatInteraction,
  options: {
    player: User;
    opponent: User;
  },
): Promise<void> {
  const { player, opponent } = options;

  if (opponent.id == player.id)
    return await errorEmbed(false, {
      interaction,
      title: "Invalid opponent.",
      reason: "You cannot play against yourself.",
    });

  const baseContainer = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## An invitation to play!"),
      new TextDisplayBuilder().setContent(
        opponent.bot
          ? "**Choose your weapon!**"
          : `**${player.displayName}** has challenged **${opponent.displayName}** to a game!\n**Both players, make your choice!**`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...rpsChoices.map((choice: RPSChoice) => {
          return new ButtonBuilder()
            .setCustomId(`rps_${choice}`)
            .setEmoji(rpsEmojis[choice])
            .setStyle(ButtonStyle.Primary);
        }),
      ),
    )
    .setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const reply = await interaction.reply({ components: [baseContainer], flags: "IsComponentsV2" });
  const playerChoices = new Map<string, RPSChoice>();

  collect(
    interaction,
    reply,
    async (buttonInteraction: ButtonInteraction, halt) => {
      if (await isButtonErrory({ i: buttonInteraction, interaction, reply, noExecuteError: true }))
        return;

      const cID = buttonInteraction.customId;
      if (cID == "please") return;

      if (buttonInteraction.user.id != opponent.id && buttonInteraction.user.id != player.id)
        return await errorEmbed(false, {
          interaction: buttonInteraction,
          title: "You aren’t participating.",
        });

      playerChoices.set(buttonInteraction.user.id, cID.split("_", 2)[1] as RPSChoice);
      if (opponent.bot) halt("game-complete");
      else {
        await buttonInteraction.reply({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Choice recorded!"))
              .setAccentColor(await colorize({ hue: Sokolors.Green })),
          ],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        if (playerChoices.size == 2) halt("game-complete");
      }
    },
    async (_, reason) => {
      if (reason == "time") {
        await interaction.editReply({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## Game timed out"),
                new TextDisplayBuilder().setContent(
                  "The game has been canceled due to inactivity.",
                ),
              )
              .setAccentColor(await colorize({ hue: Sokolors.Red })),
          ],
        });
        return;
      }

      const p1Choice = playerChoices.get(player.id);
      const p2Choice = opponent.bot ? randomize(rpsChoices) : playerChoices.get(opponent.id);
      if (!p1Choice || !p2Choice) return;

      const winner = getWinner(p1Choice, p2Choice);
      const resultContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("## Game results"),
          new TextDisplayBuilder().setContent(
            [
              `**${player.displayName}** ${rpsEmojis[p1Choice]} vs ${rpsEmojis[p2Choice]} **${opponent.displayName}**\n`,
              {
                0: "## **It’s a tie!**",
                1: `## **${player.displayName}**, you win!`,
                2: opponent.bot
                  ? `## **${opponent.displayName}** wins!`
                  : `## **${opponent.displayName}**, you win!`,
              }[winner],
            ].join("\n"),
          ),
        )
        .setAccentColor(
          await colorize({
            hue:
              winner == 0
                ? Sokolors.Blue
                : (winner == 2 && opponent.bot
                  ? Sokolors.Red
                  : Sokolors.Green),
          }),
        );

      await interaction.editReply({ components: [resultContainer] });
    },
  );

  return;
}
