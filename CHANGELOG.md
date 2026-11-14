<!-- markdownlint-disable md024 -->
<!-- preserve old changelogs here -->

# Sokora Changelog

## 0.4.0 - Heijun - Work in progress

### Added

**Particularly; additions regarding safety, correctness and bug hunting**

- A public testing build (Sokora Canary). Allows users to early-test our work.
- New `/permcheck` command, checks for Sokora’s permission in your server to see if it’s missing something.
  - Give it a channel and it’ll verify said channel’s permission overrides aren’t messing with it.
  - Give it a user and it’ll check if it can moderate it.
- Error reporting. Error embeds now have a Report button that triggers an in-app form to report bugs very easily. **Please** use it if anything breaks.

> We’ve made an effort to restructure many of the bot’s internals, aiming at stability and bug fixes (so many than we couldn’t record all of them). Do note that Sokora now runs on a lot of new code that may bug in new ways when tested by users. Report to us anything that goes wrong, we’ll fix it all ASAP. Thank you!

**Other additions**

- Added object-type settings (see `/help settings`) and in general rebuilt our settings system’s internals.
- Level rewards, you can grant roles and/or channels as a reward for reaching a certain XP level.
- Level multipliers; channels and roles that multiply the amount of XP granted.
- Importing leveling data from MEE6, Tatsu, Amari and Lurkr. See `/help import`.
- Upload images to your news. (Cannot edit or remove images, nor add images from the edit modal, we may add this in future releases.)
- Ping users or roles, link channels or add custom timestamps to news. Discord doesn’t allow this from modal input, so it uses Dynamic (Variables). See `/help variables`.
- Removing a user’s messages when banning them. Use `/moderation ban user:@USER del:true` for this.
- Functional `/changelog` command (view all version logs directly from the bot).
- Logging for changed settings, enable it from `/settings moderation`.
- Two new easter eggs, `slash` and `test`.
- “Interkora”, a command-based interface for Sokora that lets you interact with it from webhooks, other bots or with bulk commands. See docsite.
- We added a docsite with tutorials, information on the bot and a manual for Interkora, live at https://docs.sokora.org.

### Changed

- Changed the formula to calculate levels and XP, it should now be better.
- Tweaked colors to ensure they’re consistent across all embeds.
- Improved all pagination components.
- Made all collectors last the same.
- Made all containers use Discord Components V2, redesigning some of them.
- Made some containers (like the leaderboard one) more compact to fit more data per page.
- Updated `/about` and `/credits`.

### Fixed

- `/moderation ban` not working on members not in the guild.
- `/moderation lock` allowing to lock non-text channels (like a voice chat).
- Fixed the way `/ping` calculates latency.
- Some minor issues with timestamps.
- The "made with ❤️ by the Sokora team" footer in many embeds was supposed to randomize the emoji but it never did; fixed that too.
- `/moderation cases` now requires only the case ID or only the user ID to output a result.
- Reset button in `/settings` now appears when you change a text/integer setting.
- "News" are now "News posts", and instead of "adding" news you now "post" news.
- Colors from the profile picture not working reliably (especially when the picture’s dominant color is grayscale.)
- Issues with rendering custom emojis (like arrows in some buttons).
- “Humanized” settings not always being actually humanized.
- Wrong pluralization of negative numbers (-1 car instead of -1 cars, e.g.).
- RPS using wrong name when playing with a bot
- Removed duplicate (sometimes triplicate) database calls from starboard and news modules.

## 0.3.3 - 07/07/2026

### Fixed

- _No reason provided_ in some embeds that don’t have any way to provide a reason (thanks fishy)
- Flipped 2FA value in /server and /serverboard (i.e when the server has 2FA, it shows as "No 2FA") (thanks fishy)
- /ping fix + CV2

## 0.3.2 - 26/08/2025

### Changed

- User can’t use any commands in DMs (thanks @userandaname)
- You can use /user info for people outside of the server

### Fixed

- Top.gg reminders are fixed once more, now they should send **only** when you didn’t vote
- Attempt to fix temporary bans not unbanning the user due to Sokora not finding them through the cache (by fetching the ban list instead)
- "Unknown guild" error in serverboard

### Removed

- Executor in message delete events

## 0.3.1 - 23/08/2025

### Changed

- Made /help, /about, /changelog, /credits, /ping, /settings and /user settings ephemeral (only visible to you)
- Sokora alerts server owners if they enable but misconfigure showing a server invite in serverboard

### Fixed

- Fixed issues with timestamps
- Fixed some moderation commands "failing" (even though they did the job)
- Fixed invites for serverboard sometimes silently failing to create or crashing /serverboard
- Fixed topgg reminders
- Some internal fixes

## 0.3.0 - Antei - 20/08/2025

### Added

- Added a new `/games` category.
  - Added `/games rps` to play Rock, Paper, Scissors.
  - Added `/games coin` to flip a coin.
- Added a new `/math` category.
  - Added `/math graph` to graphically represent a function.
  - Added `/math calc` to execute a mathematical expression.
- Added `/help variables` to show help with _Dynamic (variables)_.
- Added `/ping` to view bot ping and latency.
- Gave a proper name to replaceable variables (`Dynamic (variables)`), and added more options:
  - `(serverowner)` - Server owner’s name
  - `(currentdate)` - Current date in the ’July 10, 2025’ format
  - `(currentdate, simple)` - Current date in the ’7/10/25’ format
  - `(currentdate, detailed)` - Current date in the ’July 10, 2025, at 1:11 PM’ format
- Added user settings as a feature.
  - Added TopGG reminders setting.
- Moderation
  - Added the ability to clear messages for a single user.
  - Added reason field to `/moderation unmute`.
  - Added the ability to silently perform moderation actions.
  - Added the ability to view all cases of a server, and to filter by case type.
- Easter eggs
  - Added two new easter eggs.
- Settings
  - Enable/disable specific easter eggs.
  - Enable easter eggs in specific channels only.
  - Give roles to users when they join.
  - Now you can set different channels for join and leave messages.
  - Whether to show an invite to your server or not in serverboard and what channel the invite should point to.
  - Whether all moderation actions should be silent or not.
  - What kind of moderation events should be logged.
  - Channel to send starred messages to, emoji to be reacted, and reaction threshold.
- Other additions
  - Added a starboard. It can be configured from `/settings starboard`.
  - Added unique member count to `/about`.
  - Added the ability for server owners to display an invite link to their servers from the serverboard.

### Changed

- Settings were rebuilt into completely new settings panes that allow to change settings from the own embed, without using commands.

### Fixed

- News
  - Fixed not being able to delete the first news post you create.
- Moderation
  - Fixed the bot crashing because of too large messages being deleted.
  - Fixed a `Jump to message` option being shown on deleted messages (you cannot jump to a deleted message).
  - Fixed the bot showing "Application didn’t respond" when unmuting someone muted by another bot.
  - Fixed the bot unable to send a moderation log when a deleted / edited message is too large. It will instead upload two text files containing old and new messages.
- _Many other fixes were made, not all of them are tracked._

### Removed

- Moderation
  - Removed the ability to add notes on users.
- Settings
  - Commands to change settings. Use the new embeds to change settings from there.
- Changelog
  - Changelog itself won’t be shown in embeds anymore (it’s too long). `/changelog` will show a link to this file.

## 0.2.0 - Kaishi - 24/12/2024

### Added

- Commands
  - `/changelog`
  - `/credits`
  - `/moderation notes`

### Changed

- The bot will remove levels when an admin changed the leveling difficulty
- Now `/leaderboard` shows 6 users per page instead of 5
- When you add the bot, it sends a message in the system channel
- Remade the message logs
- Edit logs will let you jump to the message that got edited

- `/settings`
  - Autocompletes with channels/users/roles (you don’t have to copy IDs now :tada:)
  - In the embed it will show links to channels/users/roles instead of showing IDs

- `/about`
  - Vote button added
  - Moved credits into a different command to reduce the height of the embed

### Fixed

- News
  - Major issue related to the database, where the guild wasn’t provided to ensure that news would be unique to every server, **thank you @Golem642!!!!**
  - `/news` edit’s modal errored when sending

- Moderation commands
  - `/moderation clear` removed one more message than the user provided
  - `/moderation unban` errored internally (it should send an error embed) when the user didn\’t have the "Ban Members" permission
- Typos
  - warn mentions in `/moderation warn` are now warning to be more consistent
  - Removed old markdown remnants from `/moderation slowdown`

## 0.1.0 - Kaishi - 16/11/2024

### Added

Initial release :D
