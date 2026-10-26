import { getSetting, getSettingDef } from "database/settings";
import { type SettingSettableValue, isSettingValueValid } from "types";
import { codeBlock } from "discord.js";
import { kominator } from "utils/kominator";
import { mention, unmention } from "utils/mention";
import type { Mention, SafeMessage } from "types";
import {
  InterkoraError,
  assertClause,
  assertGetter,
  assertImporter,
  assertKey,
  assertOrder,
  assertSubKey,
  isCmpOperand,
  isPagingOperand,
  type ParsedGetter,
  type ParsedImport,
  type ParsedQueryOperand,
  type ParsedSetter,
  type SupportedRetrievalFormats,
  type KS,
  isParsedGetter,
  isParsedImport,
  isParsedQueryOperand,
  requestInterkora,
  resolveEntity,
  type InterkoraPayload,
  type InterkoraPayloadIssue,
  isParsedSetter,
  type interkora,
  type ResolvedEntity,
} from ".";

function switchInnerTypes(value: string): SettingSettableValue {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (["true", "false"].includes(value)) return value === "true";
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;
  return value.includes(",") ? kominator(value) : value;
}

/*
level 1
foo "bar"

. level 2
foo "bar"
. level 3
foo "baz"
*/

function parseSokoraML(rows: string[]): unknown {
  const isArray = rows.length > 0 && rows[0].startsWith(".");
  const result: Record<string, SettingSettableValue> | Record<string, SettingSettableValue>[] =
    isArray ? [] : {};

  let held: Record<string, SettingSettableValue> = {};

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index].trim();

    if (row.trim() === "") continue;

    const hasDotPrefix = row.startsWith(".");

    if (isArray && hasDotPrefix) {
      if (Object.keys(held).length > 0)
        (result as Record<string, SettingSettableValue>[]).push(held);

      held = {};

      const content = row.slice(1).trim();
      const [key, value] = content.split(" ", 2);

      if (key) held[key] = switchInnerTypes(value ? value.trim() : "true");
    } else {
      const isLastRow = index === rows.length - 1;

      const [key, value] = row.split(" ", 2);

      if (key) held[key] = switchInnerTypes(value ? value.trim() : "true");

      if (!hasDotPrefix && isArray && isLastRow && Object.keys(held).length > 0)
        (result as Record<string, SettingSettableValue>[]).push(held);
    }
  }

  return isArray ? result : held;
}

function loop(
  content: string,
): Omit<ParsedGetter | ParsedSetter | ParsedQueryOperand | ParsedImport, "gid" | "entity"> {
  const [firstLine, ...restOfLines] = content.split("\n");
  const [order, key, subKey, preValue] = firstLine.trim().replaceAll(/\s+/g, " ").split(" ", 4);

  assertOrder(order);

  if (order === "query") {
    assertClause(key);

    if (key === "set-guild") {
      if (!subKey) throw new InterkoraError("You did not provide a guild to set.");

      return {
        action: {
          order: "query",
          key: "set-guild",
          specifier: subKey,
        },
      };
    }

    if (key === "reset-guild")
      return {
        action: {
          order: "query",
          key,
        },
      };

    if (key === "get-req") {
      if (!subKey || !["u", "h"].includes(subKey))
        throw new InterkoraError(
          "You did not specify if this ID belongs to a webhook or a user. No way to tell.",
        );

      return {
        action: {
          order: "query",
          key,
          specifier: subKey as "u" | "h",
        },
      };
    }

    if (!subKey) throw new Error("You did not provide a user/webhook ID to (re)set.");

    if (!preValue || !["u", "h"].includes(preValue))
      throw new InterkoraError(
        "You did not specify if this ID belongs to a webhook or a user. No way to tell.",
      );

    return {
      action: {
        order: "query",
        key,
        specifier: subKey,
        operand: preValue as "u" | "h",
      },
    };
  }

  if (order === "import") {
    assertImporter(key);

    if (!["m", "o", "c"].includes(subKey))
      throw new InterkoraError('operand is not any of "m","o","c"', "InvalidSeq");

    const [pV1, pV2] = (preValue ?? "").split(":", 2);
    if (!pV1 || !pV2) throw new InterkoraError("missing arguments", "InvalidSeq");
    if (!["MEE6", "TATSU", "AMARI", "LURKR"].includes(pV1))
      throw new InterkoraError(
        `${pV1} is not valid, use any of "MEE6", "TATSU", "AMARI", "LURKR" (all uppercase)`,
        "InvalidSeq",
      );

    return {
      action: {
        order: "import",
        key: key,
        operand: subKey as "m",
        specifier: preValue as "MEE6",
      },
    };
  }

  if (order === "get") {
    assertGetter(key);

    let specifier: Mention | KS | number | undefined;
    let operand: string | undefined;
    if (!subKey || subKey == ".") specifier = undefined;
    else
      switch (key) {
        case "settings": {
          const [settingKey, settingSubKey] = subKey.split(".", 2);

          assertKey(settingKey);

          if (!settingSubKey) {
            specifier = [settingKey, undefined];
            break;
          }

          assertSubKey(settingKey, settingSubKey);

          specifier = [settingKey, settingSubKey];

          break;
        }
        case "cases": {
          const [actualSubKey, actualOperand] = subKey.split("/", 2);
          const numeric = Number(actualSubKey);
          const mention = unmention(actualSubKey);
          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "USER" || mention.type === "TIMESTAMP") specifier = mention;
            else
              throw new InterkoraError(
                `Specifier **${actualSubKey}** uses a mention that is of type ${mention.type} and not USER or TIMESTAMP, the ones allowed.`,
              );

          if (actualOperand)
            if (typeof specifier === "number" || mention?.type === "USER") {
              if (!isPagingOperand(actualOperand))
                throw new InterkoraError(`Provided operand **${actualOperand}** used incorrectly.`);
            } else if (!isCmpOperand(actualOperand))
              throw new InterkoraError(`Provided operand **${actualOperand}** used incorrectly.`);

          operand = actualOperand;

          break;
        }
        case "leaderboard": {
          const numeric = Number(subKey);
          const mention = unmention(subKey);

          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "USER") specifier = mention;
            else
              throw new InterkoraError(
                `Specifier **${subKey}** uses a mention that is of type ${mention.type} and not USER, the one allowed.`,
              );

          break;
        }
        case "starboard": {
          const [actualSubKey, actualOperand] = subKey.split("/", 2);
          const numeric = Number(actualSubKey);
          const mention = unmention(actualSubKey);

          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "USER") specifier = mention;
            else
              throw new InterkoraError(
                `Specifier **${subKey}** uses a mention that is of type ${mention.type} and not USER, the one allowed.`,
              );

          if (actualOperand && (typeof specifier === "number" || !isCmpOperand(actualOperand)))
            throw new InterkoraError(`Provided operand **${actualOperand}** used incorrectly.`);

          operand = actualOperand;

          break;
        }
        case "news": {
          const [actualSubKey, actualOperand] = subKey.split("/", 2);
          const numeric = Number(actualSubKey);
          const mention = unmention(actualSubKey);

          if (!Number.isNaN(numeric)) specifier = numeric;
          else if (mention != null)
            if (mention.type === "TIMESTAMP") specifier = mention;
            else
              throw new InterkoraError(
                `Specifier **${subKey}** uses a mention that is of type ${mention.type} and not TIMESTAMP, the one allowed.`,
              );

          if (actualOperand && (typeof specifier === "number" || !isCmpOperand(actualOperand)))
            throw new InterkoraError(`Provided operand **${actualOperand}** used incorrectly.`);

          operand = actualOperand;

          break;
        }
        case "serverboard": {
          const numeric = Number(subKey);

          if (!Number.isNaN(numeric)) specifier = numeric;

          break;
        }
      }

    let format: SupportedRetrievalFormats;
    if (!preValue) format = "json";
    else if (["json", "yaml"].includes(preValue)) format = preValue as SupportedRetrievalFormats;
    else throw new InterkoraError(`Data format **${preValue}** is not valid.`);

    return {
      action: {
        order,
        key,
        specifier,
        operand,
        format,
      },
    } as ParsedGetter;
  }

  assertKey(key);

  if (order === "drop")
    return {
      action: {
        key,
        order,
      },
    };

  assertSubKey(key, subKey);

  if (order === "reset")
    return {
      action: { key, subKey, order },
    };

  const def = getSettingDef(key, subKey);

  let value: unknown;

  try {
    value =
      preValue == "\\"
        ? parseSokoraML(restOfLines)
        : (preValue == "\\\\"
          ? JSON.parse(restOfLines[0])
          : switchInnerTypes(preValue));

    if (!isSettingValueValid(value, { key, setting: subKey, def }))
      throw new InterkoraError(
        `Provided value did not fullfil type constraints (${def.type}, ${def.iterable ? "ITERABLE" : "STATIC"}).\nDetected: ${codeBlock("yaml", Bun.YAML.stringify(value))}\nTested against: ${codeBlock("yaml", Bun.YAML.stringify(def))}`,
      );
  } catch {
    throw new InterkoraError(
      `Provided value errored when checking for type constraints (${def.type}, ${def.iterable ? "ITERABLE" : "STATIC"}).\nTested against: ${codeBlock("yaml", Bun.YAML.stringify(def))}\nPlease report this to the Sokora team together with the command you ran.`,
    );
  }

  return {
    action: {
      subKey,
      key,
      order,
      value,
    },
  };
}

export async function buildPayloadFromMessage(
  message: SafeMessage,
): Promise<InterkoraPayload | InterkoraPayloadIssue> {
  const entity = await resolveEntity(message.author.id, message, message.guild);

  if (!entity) throw new Error("where the fuck is the entity");

  const isEnabled = await getSetting(message.guild.id, "interkora", "enabled");
  const whitelist = await getSetting(message.guild.id, "interkora", entity.correspondingWhitelist);
  const isAllowed = isEntityAllowed({
    whitelist,
    entity,
    ownerId: message.guild.ownerId,
  });

  // TODO: do this
  const effectiveStack = ["@order"];

  if (message.content.startsWith("soko!request")) {
    await requestInterkora(isEnabled, isAllowed, entity, message);
    return {
      entity,
      gid: message.guildId,
      effectiveStack: effectiveStack.join("\n"),
      effectiveName: "Requested",
      // TODO : ???
      // typing of this is broken
    };
  }

  if (!isEnabled)
    return {
      entity,
      gid: message.guildId,
      effectiveName: "Disabled",
      effectiveStack: effectiveStack.join("\n"),
      errorMessage: "Not enabled.",
    };

  if (!isAllowed)
    return {
      entity,
      gid: message.guildId,
      effectiveStack: effectiveStack.join("\n"),
      effectiveName: "NoPermission",
      errorMessage: `At ${mention(Date.now(), "DEFAULT_TIMESTAMP")}, unauthorized user/application ${mention(message.author.id, "USER")} attempted to run Interkora commands.`,
    };

  let queryGuildId = message.guildId;
  const payload: InterkoraPayload = {
    entity,
    gid: message.guildId,
    actualPayload: {
      getters: [],
      setters: [],
      imports: [],
      queries: [],
    },
  };

  const gidRegex = /gid:\d+/gm;

  for (const [index, _c] of message.content.split("soko!").slice(1).entries())
    try {
      const gid = gidRegex.exec(_c);
      const gidParameter = gid?.[0];

      if (gidParameter) queryGuildId = gidParameter;
      const c = gidParameter ? _c.replaceAll(gidRegex, "") : _c;

      const out = loop(c);

      if (isParsedQueryOperand(out)) {
        if (gidParameter)
          return {
            gid: queryGuildId,
            errorMessage: "Query operand had a GID param for whatever reason.",
            entity,
            effectiveName: "InvalidSeq",
            effectiveStack: effectiveStack.join("\n"),
          };

        if (out.action.key === "reset-guild") {
          queryGuildId = message.guildId;
          continue;
        }
        if (out.action.key === "set-guild") {
          const newGuildId: string = out.action.specifier;
          const isItkEnabled = await getSetting(newGuildId, "interkora", "enabled");
          if (!isItkEnabled)
            return {
              gid: queryGuildId,
              errorMessage: `Guild ${newGuildId} does not exist OR does not have Interkora enabled.`,
              entity,
              effectiveName: "InvalidSeq",
              effectiveStack: effectiveStack.join("\n"),
            };

          queryGuildId = newGuildId;
          continue;
        }
        payload.actualPayload.queries.push({
          ...out,
          gid: queryGuildId,
        });
      }

      if (isParsedImport(out))
        payload.actualPayload.imports.push({
          ...out,
          gid: queryGuildId,
        });
      else if (isParsedGetter(out))
        payload.actualPayload.getters.push({
          ...out,
          gid: queryGuildId,
        });
      else if (isParsedSetter(out))
        payload.actualPayload.setters.push({
          ...out,
          gid: queryGuildId,
        });
    } catch (error) {
      if (error instanceof InterkoraError)
        return {
          effectiveName: error.effectiveName,
          effectiveStack: effectiveStack.join("\n"),
          gid: queryGuildId,
          entity,
          errorMessage: `Interkora error\nSeq ${index}\nErr [${error.cause}]: ${error.message}.`,
        };

      throw error; // unhandled, something broke
    }

  return payload.actualPayload.getters.length > 10 ||
    payload.actualPayload.setters.length > 10 ||
    payload.actualPayload.queries.length > 10 ||
    payload.actualPayload.imports.length > 10
    ? {
        effectiveName: "SeqSz",
        effectiveStack: effectiveStack.join("\n"),
        gid: message.guildId,
        entity,
        errorMessage: `Interkora error\nSingle message sequence is too large (exceeds 10 Interkora calls of the same kind message).\nOptimize calls or split into multiple messages.`,
      }
    : payload;
}

// this is obviously temp.
export async function buildMessageFromPayload(
  payload: Awaited<ReturnType<typeof interkora>>,
): Promise<string> {
  await fetch("https://bing.com" + JSON.stringify(payload));
  return "sic seben";
}

function isEntityAllowed(argument0: {
  whitelist: string[];
  entity: ResolvedEntity;
  ownerId: string;
}): boolean {
  console.log(argument0);
  // TODO!!
  return true;
}

/*
IDEA for compactness
s!set leveling xp_rate \
base 2
multiplier 1.5
cap 1000
*/
