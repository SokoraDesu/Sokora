# Sokora Contributing Guide

## Prerequisites

- Basic knowledge of [TypeScript](https://typescriptlang.org/) and [discord.js](https://discord.js.org/).
- [Bun](https://bun.sh) installed.
- [PostgreSQL](https://www.postgresql.org/download/) installed.
- Port 5432 on your machine free, Sokora needs it.

## Get started with contributing

### Getting the code

- Make a fork of this repository.
- Clone your fork.

### Creating your bot

- Head over to the [Discord Developer Portal](https://discord.com/developers/applications) and make a new application.
- Invite your bot to your server.
- Reset and then copy your bot's token.

### PostgreSQL

- Check if you already have PostgreSQL installed on your machine. If not, refer to your platform's package manager or get it from [postgresql.org](https://www.postgresql.org/download/).
- If you're on Windows, proceed with the set up, remember your port (or keep it as `5432`) as it will be used later on.
- Launch `sudo -u postgre psql` (or SQL Shell in the start menu of Windows, you'd have to log into the postgre account).
- Create a new user with this command: `CREATE USER name CREATEDB PASSWORD 'pass';`, where `CREATEDB` gives the user the permission to create new databases and `PASSWORD` lets the bot connect to the database.
  - Absent semicolons cause it to silently fail. Make sure to type them.
  - Check if the user has been created by typing `\du`.
- Create a database like so: `CREATE DATABASE dbname OWNER 'name';`
  - Check if the database has been created by quitting the default database with `\q` and launching `psql -U name -d dbname` where name and dbname are the same names you provided before.

Follow to the next section to create a .env variable that'll let Sokora access the database.

### Setting up .env

- Run `bun run setup` and our CLI tool will install dependencies and write .env for you. It'll ask you to paste in your bot's token and the PostgreSQL credentials (assuming you're NOT planning to run from Docker; it'll ask that first).
  - For the credentials, provide in order:
    - The user you created (`name`).
    - The database name (`dbname`).
    - The password you created (`pass`).
    - The host (leave empty unless you know it's not `localhost` for some reason, which it should be set to by default).
    - The port (check what it is by running `psql -U name -d dbname -c "SHOW port;"`).

### Running

Just run `bun dev`.

## Contribution guide

A few, simple guidelines onto how to contribute to Sokora.

### Reminders

- Remember to commit changes to `bun.lock` file.

### Code styling guidelines

A few guides onto how code contributed to Sokora should look like.

- Ensure to run the static formatter and analyzer (via `bun run ql`) before committing.
- Use `camelCase` for both variables and function names.
- Keep lines reasonably short, don't fear linebreaks. Of course, longer lines are valid where needed.
- Use early returns to avoid nesting.
- Avoid curly braces when an `if`/`else`/`throw`/`return` statement can be one-lined.
- Avoid non-nullish assertions, they are valid only when absolutely needed.
- Use the functions from `safeThings` instead of using the cache or fetching to:
  - Reply to an interaction (`safeReply`)
  - Get members (`safeMembers`)
  - Get a channel (`safeChannel`)
  - Get a role (`safeRole`)
  - Get an individual member (`safeMember`)
  - Get a user (`safeUser`)
  - Get a guild (`safeGuild`)
- Prefer, when possible, `Promise.all` over having several `await` statements.

### Subete commit system (WIP)

We've created an alternative to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), aimed at improving its functionality. It'll be required to be used to contribute to this project when it gets proper documentation via a website.

Full layout: `![<type>@[scope] [part]] <description>`, where:

- `!` signifies a breaking change.
- `type` is the type of the commit, e.g `fix`, `feat`, `refactor`, etc.
- `scope` is where the changes happened.
- `part` shows the part of the commit.
- And finally, `description` is where the changes are described.

#### Examples

`[fix@settingsEmbed pt3] fixed OBJECT type`
`[chore] Update enhanced-ms to 4.3.0`
`![fix@settings] types have been fixed`

---

Be sure to open a pull request when you're ready to push your changes. Be descriptive of the changes you've made.

![PLEASE SUBMIT A PR, NO DIRECT COMMITS](https://user-images.githubusercontent.com/51555391/176925763-cdfd57ba-ae1e-4bf3-85e9-b3ebd30b1d59.png)
