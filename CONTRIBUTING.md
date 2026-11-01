# Contributing to Sokora

We're thankful that you're willing to contribute to Sokora! This overall guide will help you get things done in a way appropriate for this project.

## Prerequisites

- Basic knowledge of [TypeScript](https://typescriptlang.org/) and [discord.js](https://discord.js.org/).
- [Bun](https://bun.sh) installed.
- Either `A` or `B`:
  - `A`
    - [PostgreSQL](https://www.postgresql.org/download/) installed.
    - Port 5432 on your machine free, Sokora needs it.
  - `B`
    - [Docker](https://www.docker.com/products/docker-desktop/) installed.

## Get started with contributing

### Getting the code

- Make a fork of this repository.
- Clone your fork.

### Creating your bot

- Head over to the [Discord Developer Portal](https://discord.com/developers/applications) and make a new application.
- Invite your bot to your server.
- Reset and then copy your bot’s token.

### Setting Sokora up

- Run the setup utility with `bun run setup` and our CLI tool will install dependencies and write .env for you. It’ll ask for things like user token, control channel IDs, and whether you're using Docker for development or not.

We assume you're using Docker, as it is our recommended way of developing.

If you're NOT doing that, then refer to [the next section](#manual-setup-for-not-using-docker), and note there are prior steps to running the setup utility.

### Manual setup for not using Docker

If you prefer to run Sokora without going through a container, you must setup PostgreSQL locally before running the setup utility.

#### PostgreSQL

- Check if you already have PostgreSQL installed on your machine. If not, refer to your platform’s package manager or get it from [postgresql.org](https://www.postgresql.org/download/).
- If you’re on Windows, proceed with the set up, remember your port (or keep it as `5432`) as it will be used later on.
- Launch `sudo -u postgre psql` (or SQL Shell in the start menu of Windows, you’d have to log into the postgre account).
- Create a new user with this command: `CREATE USER name CREATEDB PASSWORD ’pass’;`, where `CREATEDB` gives the user the permission to create new databases and `PASSWORD` lets the bot connect to the database.
  - Absent semicolons cause it to silently fail. Make sure to type them.
  - Check if the user has been created by typing `\du`.
- Create a database like so: `CREATE DATABASE dbname OWNER ’name’;`
  - Check if the database has been created by quitting the default database with `\q` and launching `psql -U name -d dbname` where name and dbname are the same names you provided before.

#### Going back to the setup utility

Tell it you won't use Docker, then provide:

- The user you created (`name`).
- The database name (`dbname`).
- The password you created (`pass`).
- The host (leave empty unless you know it’s not `localhost` for some reason, which it should be set to by default).
- The port (check what it is by running `psql -U name -d dbname -c "SHOW port;"`).

### Running

If running on your local hardware, just run `bun dev`.

If you prefer to run the Docker container, run `docker compose up --build --watch`. Or just `./run.sh` if on macOS/Linux.

## Contribution guide

A few, simple guidelines onto how to contribute to Sokora. These are more than enough if you’re aiming at a single pull request helping with something specific; more determined developers might want the much more complete [developer docsite instead](https://docs.sokora.org/dev).

Some things you should keep in mind at all times.

- Ensure to run the static formatter and analyzer (via `bun run ql`) before committing. It's relatively strict, fix any issues it reports and resort to ignore comments only if absolutely necessary.
- Remember to commit changes to `bun.lock` file.
- Do not repeat yourself, at all. Code duplication creates problems. Extract.
- Document via TSDoc anything that isn’t _actually_ self-explanatory and other developers will have to touch often (like utility functions or important parts of important files).
- Use the functions from `safeThings` instead of using `discord.js` provided methods whenever there’s one available.

### Coding guidelines

A few guides onto how code contributed to Sokora should look like.

- Use `camelCase` for both variables and function names. Use `CONST_CASE` for constant values that are shared, exported or not.
- Use early returns to avoid nesting.
- Avoid non-nullish assertions, they are valid only when absolutely needed.
- Prefer, when possible, `Promise.all` over having several `await` statements.

There's not a deep style guide since the code QL task should be able to handle everything on its own.

### Commit guidelines

We require all commits to strictly follow a very specific commit convention we've made.

```bash
![<type>@[scope] [part]] <description> [>

extended description]

[tags]
```

Please refer to [the Subete commit guidelines](https://docs.sokora.org/dev/subecommits).

### Change merging guildelines

Be sure to open a pull request when you’re ready to push your changes. If you happen to have write access to our repo, remember to:

![PLEASE SUBMIT A PR, NO DIRECT COMMITS](https://user-images.githubusercontent.com/51555391/176925763-cdfd57ba-ae1e-4bf3-85e9-b3ebd30b1d59.png)

Keep the description as short as you can, but not shorter. Pull requests should explain in detail WHAT they do and WHY. The “how” is usually irrelevant, your code should be self-explanatory (if it’s not, then it’s likely wrong).

If a pull request is large in scope OR if it contains “redundant” commits (such as to fix linter issues with the PR), it should be squashed into a single commit upon merge.
