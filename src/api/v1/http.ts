import type { Client } from "discord.js";

function error(config: {
  request: Request;
  /** machine parseable error code
   * TODO: statically type
   */
  title: string;
  /**
   * HTTP status code
   */
  status: number;
  /**
   * human-readable short explanation of what's wrong
   */
  detail: string;
}): Response {
  return Response.json(
    {
      type: `https://sokora.org/docs/interkora-http/#error-${config.title}`,
      title: config.title,
      status: config.status,
      detail: config.detail,
      instance: config.request.url,
    },
    {
      status: config.status,
      headers: new Headers({
        "Content-Type": "application/problem+json",
      }),
    },
  );
}

export const server = (client: Client): ReturnType<typeof Bun.serve> => {
  return Bun.serve({
    port: 3067,
    hostname: "0.0.0.0",

    routes: {
      "/": () => new Response("Bot is running!"),

      "/g/:guild_id": request => {
        return client.guilds.cache.has(request.params.guild_id)
          ? Response.json({
              status: "ok",
              discord: client.isReady(),
            })
          : error({
              request,
              status: 404,
              title: "guild-not-found",
              detail: `Guild ID "${request.params.guild_id}" was not found in bot cache.`,
            });
      },
    },

    fetch: request => {
      return error({
        request,
        status: 404,
        title: "not-found",
        detail: `Route "${request.url}" not found.`,
      });
    },
  });
};
