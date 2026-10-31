import type { Client } from "discord.js";
import { resolveEntity, type ERROR_CODE } from ".";
import { getIdByToken } from "database/interkora";

/**
 * TypeScript monster that turns PascalCase into kebab-case literal types. Not mine :pray:.
 */
type Hell<S extends string, First extends boolean = true> = S extends `${infer C}${infer Rest}`
  ? `${C extends Uppercase<C>
      ? C extends Lowercase<C>
        ? C
        : `${First extends true ? "" : "-"}${Lowercase<C>}`
      : C}${Hell<Rest, false>}`
  : S;

type HTTPAPI_ERROR_CODE = Hell<
  ERROR_CODE | "NotFound" | "NoAuth" | "NoValidAuth" | "NoResolvedEntity"
>;

type Config = {
  status: number;
  request: Request;
  deprecated?: string;
  etag?: string;
} & (
  | {
      error: true;
      title: HTTPAPI_ERROR_CODE;
      detail: string;
    }
  | {
      error: false;
      json: Record<string, unknown>;
    }
);

const path = (request: Request): string => new URL(request.url).pathname;

function respond(config: Config): Response {
  const json = config.error
    ? {
        type: `https://sokora.org/docs/interkora/http-errors#${config.title}`,
        title: config.title,
        status: config.status,
        detail: config.detail,
        instance: config.request.url,
      }
    : config.json;

  const headers = new Headers({
    "Content-Type": config.error ? "application/problem+json" : "application/json",
    Accept: "application/json",
    Host: "interact.sokora.org",
    Location: path(config.request),
    "Deprecation-Notice": config.deprecated ?? "none",
    "Accept-Version": "1",
  });

  if (config.etag) headers.append("ETag", config.etag);

  return Response.json(json, {
    status: config.status,
    headers,
  });
}

export const server = (client: Client): ReturnType<typeof Bun.serve> => {
  return Bun.serve({
    port: 3067,
    hostname: "0.0.0.0",

    routes: {
      "/": request => {
        return respond({
          error: false,
          request,
          status: 200,
          json: {
            httpOk: true,
            botOk: client.isReady(),
          },
        });
      },

      "/g/:guild_id": async request => {
        const token = request.headers.get("Authorization");

        if (!token)
          return respond({
            error: true,
            request,
            status: 403,
            title: "no-auth",
            detail: `Interkora token not provided.`,
          });

        const id = await getIdByToken(token.replace("Bearer ", ""));

        if (!  id || id.trim() == "" )
          return respond({
            error: true,
            request,
            status: 403,
            title: "no-valid-auth",
            detail: `Interkora token is not valid.`,
          });

        const guild = client.guilds.cache.get(request.params.guild_id);

        if (!guild)
          return respond({
            error: true,
            request,
            status: 404,
            title: "not-found",
            detail: `Guild ID "${request.params.guild_id}" was not found in bot cache.`,
          });

        const entityData = await resolveEntity(id, undefined, guild);

        if (!entityData)
          return respond({
            error: true,
            request,
            status: 500,
            title: "no-resolved-entity",
            detail: `Entity ID "${id}" failed to resolve, despite the token existing. Report this please.`,
          });

        return respond({
          error: false,
          request,
          status: 200,
          json: {
            id: guild.id,
            name: guild.name,
            isUsable: true, // TODO: make false if interkora is disabled AND not add the thing below
            _links: {
              self: {
                href: path(request),
                method: "GET",
              },
              getSettings: {
                href: path(request) + "/s/",
                method: "GET",
                encType: "application/json",
              },
              updateSettings: {
                href: path(request) + "/s/",
                method: "PATCH",
                encType: "application/json",
              },
            },
          },
        });
      },
    },

    fetch: request => {
      return respond({
        error: true,
        request,
        status: 404,
        title: "not-found",
        detail: `Route "${request.url}" not found.`,
      });
    },
  });
};
