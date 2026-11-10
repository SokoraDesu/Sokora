import { getSetting } from "database/settings";
import type { SettingReturnType } from "types";
import {
  ContainerBuilder,
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  type User,
  type ChatInputCommandInteraction,
} from "discord.js";
import ms from "enhanced-ms";
import { PotatoState } from "states";
import { checkForS } from "utils/checkForS";
import { colorize, Sokolors } from "utils/colorize";
import { mention } from "utils/mention";
import { assertInteraction, type SafeChatInteraction } from "types";

// TODO:
// recreate this but make it opt-in, as per the feedback here:
// https://github.com/SokoraDesu/Sokora/pull/109#discussion_r4471441447

export const data = new SlashCommandSubcommandBuilder()
  .setName("hotpotato")
  .setDescription("Starts a hot potato game.");

async function burnThePotato(
  interaction: SafeChatInteraction,
  settings: NonNullable<SettingReturnType<"games", "hot_potato">>,
  user: User,
): Promise<void> {
  const state = PotatoState.get(interaction.guildId);
  if (!state) return;
  const holdingUser = await interaction.guild.members.fetch(state.heldBy);
  const muteDurationMs = ms(settings.mute_duration * 1000);
  if (!muteDurationMs) return;
  const muteDuration = Temporal.Now.instant()
    .add(Temporal.Duration.from({ seconds: settings.mute_duration }))
    .toString();
  let isSuccess = true;
  if (holdingUser.moderatable)
    await holdingUser.edit({
      communicationDisabledUntil: muteDuration,
      reason: "Lost a hot potato game :(",
    });
  else isSuccess = false;

  /* await userLogEmbed(
    holdingUser.user,
    holdingUser.guild,
    `Hey, you’ve been muted in ${interaction.guild.name} (not for anything bad though)`,
    `You’ve been muted for ${muteDurationMs} because of a hot potato game you lost.\n\nIf you weren’t even playing and this annoys you, ask people at the server to lift your mute and to not play with you. Note it’s the server staff that chooses to enable the game, and it can’t be disabled per user.`,
  ); */
  PotatoState.delete(interaction.guildId);
  if (!interaction.channel.isSendable()) return;
  await interaction.channel.send({
    components: [
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            user.id === holdingUser.id
              ? `## ${user.displayName} tried to throw his hot potato at someone else, and failed`
              : `## ${checkForS(user.displayName)} potato got too hot in ${checkForS(holdingUser.displayName)} hands and they ate it… bad idea`,
          ),
          new TextDisplayBuilder().setContent(
            user.id === holdingUser.id
              ? (isSuccess
                ? `Poor human being… **${mention(holdingUser.id, "USER")} got muted for ${muteDurationMs}**, because their mouth burnt.\n\nBetter luck next time.`
                : `Worst part is ${mention(holdingUser.id, "USER")} isn’t actually getting any punishment for loosing because Sokora can’t mute them. Is this even fair?`)
              : (isSuccess
                ? `Poor human being… **${mention(holdingUser.id, "USER")} got muted for ${muteDurationMs}**, because their mouth burnt.\n\nHow about y’all wait before taking the potato next time?`
                : `Well, bad idea unless you’re more powerful than Sokora, which ${mention(holdingUser.id, "USER")} somehow is. They didn’t burn, actually, but at least they lost and we all know it. Laugh at them or something.`),
          ),
        )
        .setAccentColor(
          await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Yellow }),
        ),
    ],
    flags: "IsComponentsV2",
  });
}

export async function run(interaction: ChatInputCommandInteraction): Promise<void> {
  assertInteraction(interaction);

  if (!interaction.channel.isSendable()) return; // IDEA: maybe move to assert?
  const settings = await getSetting(interaction.guildId, "games", "hot_potato");

  if (!settings?.enabled) {
    await interaction.reply({
      content: "Game is not enabled!",
      flags: "Ephemeral",
    });
    return;
  }

  if (PotatoState.exists(interaction.guildId)) {
    await interaction.reply({
      content: "Game already running!",
      flags: "Ephemeral",
    });
    return;
  }

  const burnTimeout = ms(settings.burn_timeout * 1000);

  const user = interaction.user;
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Hey everyone, ${mention(user.id, "USER")} brought a burning hot potato!`,
      ),
      new TextDisplayBuilder().setContent(
        `Y’all have **${burnTimeout}** to pass it to someone else!\n\n**React with 🥔 to someone else to pass them the potato if you have it.**`,
      ),
    )
    .setAccentColor(
      await colorize({ user, avatar: user.displayAvatarURL(), hue: Sokolors.Yellow }),
    );

  PotatoState.set(interaction.guildId, {
    heldBy: user.id,
    startedBy: user.id,
    started: Date.now(),
    lastPass: Date.now(),
    passes: 0,
  });

  setTimeout(async () => {
    await burnThePotato(interaction, settings, user);
  }, settings.burn_timeout * 1000);

  await interaction.reply({ components: [container], flags: ["IsComponentsV2"] });
}
