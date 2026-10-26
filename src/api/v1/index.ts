import {
  getSetting,
  getSettingCategory,
  resetSetting,
  resetSettingCategory,
  serverSettingsKeys,
  setSetting,
  settingsDefinition,
  type TS,
} from "database/settings";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  codeBlock,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  Webhook,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  type Guild,
  type ButtonInteraction,
  GuildMember,
} from "discord.js";
import type { SettingReturnType, SettingKeyFor } from "types";
import { mention } from "utils/mention";
import { colorize, Sokolors } from "utils/colorize";
import { safeAlertChannel, safeGuild, safeMember } from "utils/safeThings";
import { as, type Mention, type SafeMessage } from "types";
import { getCase, listUserCases, listGuildCases } from "database/moderation";
import { fetchServerboard, getServerboardEntry } from "database/serverboard";
import { buildLeveler, getGuildLeaderboard, getUserXp } from "database/leveling";
import { getLatestNews, getNews } from "database/news";
import {
  addWhitelist,
  getRequestors,
  addRequestor,
  remWhitelist,
  getEntityPermissions,
} from "database/interkora";
import { Supported, type SupportedAndRewarded } from "@subetedesu/honlvlimport";
import { client } from "botfile";

export const COMMANDS = ["set", "reset", "drop", "get", "query", "import"] as const;
type COMMAND = (typeof COMMANDS)[number];
export const GETTERS = [
  "settings",
  "leaderboard",
  "starboard",
  "serverboard",
  "cases",
  "news",
] as const;
export const IMPORTERS = ["level:xp", "level:rewards"] as const;
export const CLAUSES = [
  "set-guild",
  "reset-guild",
  "set-whitelisted",
  "reset-whitelisted",
  "get-ent",
  "get-req",
] as const;
export const ERROR_CODES = [
  "InvalidSeq",
  "Requested",
  "InvalidOrder",
  "NoPermission",
  "SeqSz",
  "Disabled",
] as const;
export type ERROR_CODE = (typeof ERROR_CODES)[number];

export type CmpOperand = ">" | "<" | ">=" | "<=";
export type PagingOperand = "-" | "+";
export type SupportedRetrievalFormats = "json" | "yaml";

export class InterkoraError extends Error {
  public effectiveStack: string;
  public effectiveName: ERROR_CODE;

  constructor(message: string, effectiveName: ERROR_CODE = "InvalidSeq") {
    super(message);
    this.name = "InterkoraError";
    this.effectiveName = effectiveName;
    this.effectiveStack = "TODO";
  }

  public toString(): string {
    return `${this.name} [${this.effectiveName}]: ${this.message}\nAt ${this.effectiveStack}.`;
  }
}

export function assertOrder(o: string): asserts o is (typeof COMMANDS)[number] {
  if (typeof o === "string" && COMMANDS.includes(o as "set")) return;
  throw new InterkoraError(
    `Order **${o}** is not valid. Choose any of ${COMMANDS.map(s => `\`${s}\``).join(", ")}.`,
    "InvalidOrder",
  );
}
export function assertGetter(o: string): asserts o is (typeof GETTERS)[number] {
  if (typeof o === "string" && GETTERS.includes(o as "settings")) return;
  throw new InterkoraError(`Key **${o}** is not a getter.`, "InvalidSeq");
}
export function assertImporter(o: string): asserts o is (typeof IMPORTERS)[number] {
  if (typeof o === "string" && IMPORTERS.includes(o as "level:xp")) return;
  throw new InterkoraError(`Key **${o}** is not an importer.`, "InvalidSeq");
}
export function assertClause(o: string): asserts o is (typeof CLAUSES)[number] {
  if (typeof o === "string" && CLAUSES.includes(o as "set-guild")) return;
  throw new InterkoraError(`Key **${o}** is not a query clause.`, "InvalidSeq");
}
export function assertKey(k: string): asserts k is keyof TS {
  if (typeof k === "string" && serverSettingsKeys.includes(k as "leveling")) return;
  throw new InterkoraError(
    `Setting key **${k}** is not valid. Choose any of ${serverSettingsKeys.map(s => `\`${s}\``).join(", ")}.`,
  );
}
export function assertSubKey<K extends keyof TS>(k: K, s: string): asserts s is SettingKeyFor<K> {
  if (Object.hasOwn(settingsDefinition[k].settings, s)) return;
  throw new InterkoraError(
    `Setting **${k}** is not a valid member of ${s}. Choose any of ${Object.keys(
      settingsDefinition[k],
    )
      .map(s => `\`${s}\``)
      .join(", ")}`,
  );
}
export const isPagingOperand = (o: string): o is PagingOperand => /(-|\+)/.test(o);
export const isCmpOperand = (o: string): o is CmpOperand => /(>=|<=|>|<)/.test(o);

type AnyPayloadMember = ParsedGetter | ParsedSetter | ParsedQueryOperand | ParsedImport;
type AnyPayloadMemberStandalone = Omit<AnyPayloadMember, "gid">;

export const isParsedGetter = (o: AnyPayloadMemberStandalone): o is Omit<ParsedGetter, "gid"> =>
  o.action.order === "get";
export const isParsedImport = (o: AnyPayloadMemberStandalone): o is Omit<ParsedImport, "gid"> =>
  o.action.order === "import";
export const isParsedQueryOperand = (
  o: AnyPayloadMemberStandalone,
): o is Omit<ParsedQueryOperand, "gid"> => o.action.order === "query";
export const isParsedSetter = (o: AnyPayloadMemberStandalone): o is Omit<ParsedSetter, "gid"> =>
  ["set", "drop", "reset"].includes(o.action.order);

export const cmpOperandMap: Record<CmpOperand, (a: number, b: number) => boolean> = {
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
};

export const isOpThan = (op: CmpOperand, a: number, b: number): boolean => cmpOperandMap[op](a, b);

interface ParsedSuccess {
  gid: string;
  entity: ResolvedEntity;
}

export type KS<K extends keyof TS = keyof TS> = [K, SettingKeyFor<K> | undefined];

export interface ParsedImport extends Omit<ParsedSuccess, "entity"> {
  action: {
    order: "import";
    key: "level:xp" | "level:rewards";
    specifier: "MEE6" | `${keyof Omit<typeof Supported, "MEE6">}:${string}`;
    operand: "m" | "o" | "c";
  };
}

export interface ParsedGetter<K extends keyof TS = keyof TS> extends Omit<ParsedSuccess, "entity"> {
  action: {
    order: "get";
    format: SupportedRetrievalFormats;
  } & (
    | ({
        key: "cases";
      } & (
        | {
            specifier: number;
            operand: "+" | "-";
          }
        | {
            specifier: Mention;
            operand: CmpOperand;
          }
        | {
            specifier: undefined;
            operand: undefined;
          }
      ))
    | {
        key: "settings";
        specifier?: KS<K> | undefined;
        operand?: string;
      }
    | {
        key: "starboard";
        specifier?: Mention | number | undefined;
        operand?: string;
      }
    | {
        key: "news";
        specifier?: Mention | number | undefined;
        operand?: string;
      }
    | {
        key: "serverboard";
        specifier?: "." | number | undefined;
        operand?: string;
      }
    | {
        key: "leaderboard";
        specifier?: Mention | number;
        operand?: undefined;
      }
  );
}

export interface ParsedSetter<K extends keyof TS = keyof TS> extends Omit<ParsedSuccess, "entity"> {
  action:
    | {
        order: "set";
        key: K;
        subKey: SettingKeyFor<K>;
        value: SettingReturnType<K, SettingKeyFor<K>>;
      }
    | {
        order: "reset";
        key: K;
        subKey: SettingKeyFor<K>;
      }
    | { order: "drop"; key: K };
}

export interface ParsedQueryOperand extends Omit<ParsedSuccess, "entity"> {
  action:
    | {
        order: "query";
        key: "set-guild";
        specifier: string;
      }
    | {
        order: "query";
        key: "get-req";
        specifier: "u" | "h";
      }
    | {
        order: "query";
        key: "reset-guild";
      }
    | {
        order: "query";
        key: `${"re" | ""}set-whitelisted` | "get-ent";
        specifier: string;
        operand: "u" | "h";
      };
}

export interface InterkoraPayload extends ParsedSuccess {
  actualPayload: {
    getters: ParsedGetter[];
    setters: ParsedSetter[];
    imports: ParsedImport[];
    queries: ParsedQueryOperand[];
  };
}
export interface InterkoraPayloadIssue extends ParsedSuccess {
  effectiveStack: string;
  effectiveName: ERROR_CODE;
  member?: AnyPayloadMember;
  errorMessage?: string;
}

async function runGetter(getter: ParsedGetter, client: Client): Promise<string> {
  const guildId = getter.gid;
  const Stringify: (data: unknown) => string = (data: unknown) =>
    getter.action.format === "json" ? JSON.stringify(data) : Bun.YAML.stringify(data);

  if (getter.action.key === "settings") {
    if (!getter.action.specifier) throw new Error("No specifier provided.");
    return Stringify(
      getter.action.specifier[1]
        ? await getSetting(guildId, getter.action.specifier[0], getter.action.specifier[1])
        : await getSettingCategory(guildId, getter.action.specifier[0]),
    );
  }

  if (getter.action.key === "cases") {
    const cases = (await listGuildCases(guildId)).toSorted((a, b) => b.id - a.id);

    if (!getter.action.specifier) return Stringify(cases.slice(0, 5));

    if (typeof getter.action.specifier === "number")
      return Stringify(
        getter.action.operand === "-"
          ? await getCase(guildId, getter.action.specifier)
          : cases.slice(getter.action.specifier, getter.action.specifier + 5),
      );

    if (getter.action.specifier.type === "TIMESTAMP") {
      const comparable = Number(getter.action.specifier.res);
      if (!getter.action.operand)
        throw new Error("No action.operand in " + Bun.YAML.stringify(getter));

      return Stringify(
        cases.filter(c =>
          isOpThan(getter.action.operand as CmpOperand, c.timestamp.valueOf() / 1000, comparable),
        ),
      );
    }

    return Stringify(await listUserCases(guildId, getter.action.specifier.res));
  }

  if (getter.action.key === "serverboard") {
    const board = await fetchServerboard(client);
    console.debug(board.map(b => b.guild.name));

    if (getter.action.operand === ".") {
      const localGuild = board.find(v => v.guild.id == guildId);
      if (!localGuild?.guild) return Stringify({});
      const serverEmbed = await getServerboardEntry({ guild: localGuild.guild });
      return Stringify(serverEmbed);
    }

    const requestedGuild = board[((getter.action.specifier as number | undefined) ?? 1) - 1] ?? {};
    if (!requestedGuild?.guild) return Stringify({});
    const serverEmbed = await getServerboardEntry({ guild: requestedGuild.guild });
    return Stringify(serverEmbed);
  }

  if (getter.action.key === "leaderboard") {
    if (!getter.action.specifier || typeof getter.action.specifier == "number") {
      const out = await getGuildLeaderboard(guildId);
      const start = (getter.action.specifier ?? 1) - 1;

      return Stringify(out.slice(start, start + 10));
    }

    const xp = await getUserXp(guildId, getter.action.specifier.res);

    // TODO: get user level too
    // which takes me to another task
    // TODO: add more methods that use pure SQL instead of JS-side logic for getting things
    // and maybe TODO: move pagination too from JS slicing to SQL limiting
    return Stringify({
      xp,
    });
  }

  if (getter.action.key === "news") {
    if (!getter.action.specifier || typeof getter.action.specifier === "number") {
      const news =
        typeof getter.action.specifier === "number"
          ? await getNews(guildId, getter.action.specifier)
          : await getLatestNews(guildId);

      return Stringify(news ?? { error: "No news." });
    }

    return Stringify({ error: "Not yet supported. :SOB:" });
  }

  if (getter.action.key === "starboard") return Stringify({ error: "Not implemented." });

  throw new Error("shouldn’t happen (edge case in execGetter)");
}

export async function requestInterkora(
  isEnabled: boolean,
  isWhitelisted: boolean,
  entity: ResolvedEntity,
  message: SafeMessage,
): Promise<void> {
  if (!isEnabled) {
    await message.reply("Interkora is not enabled in this guild.");
    return;
  }
  if (isWhitelisted) {
    await message.reply("You’re already whitelisted!");
    return;
  }

  const entityType = entity.correspondingWhitelist === "webhook_whitelist" ? "h" : "u";

  const requestors = await getRequestors(message.guildId, entityType);
  const isRequestor = requestors.some(v => v.entity_id === entity.userId);
  if (isRequestor) {
    await message.reply("You’ve already requested Interkora access.");
    return;
  }

  await addRequestor(message.guildId, entity.userId, entityType);
  const channel = await safeAlertChannel(message.guild, true);
  const reason = message.content.replace("s!request", "").trim();
  const requestContainer = new ContainerBuilder();
  const start = [
    new TextDisplayBuilder().setContent(
      `## ${mention(message.author.id, "USER")} wants Interkora access`,
    ),
    new TextDisplayBuilder().setContent(
      [
        `**Requested at**: ${mention(message.createdTimestamp, "DEFAULT_TIMESTAMP")}`,
        `**Sent to**: ${mention(message.channelId, "CHANNEL")} (thereby guild is **${message.guild.name}**)`,
        `**Requester is a**: ${message.author.bot ? "bot" : (message.webhookId ? "webhook" : "human")}`,
        reason == "" ? "Reason wasn’t even provided." : `**Reason is**: ${reason}`,
      ].join("\n"),
    ),
  ];

  if (entity.avatarURL)
    requestContainer.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(start)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(entity.avatarURL)),
    );
  else requestContainer.addTextDisplayComponents(start);

  requestContainer
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `\n✅ Authorize this by typing \`s!query set-whitelisted ${message.author.id} ${message.webhookId ? "u" : "h"}\`, or with the button below.\n❌ Deny this by doing nothing. Note they may request it again.\n\n🛡️ After allowing, deny it if desired by running \`s!query reset-whitelisted ${message.author.id} ${message.webhookId ? "u" : "h"}\`.\n\nAll these things can also be done from PSE, access it with \`/settings interkora\`.\nDoes any of this give you doubts? Give \`/help interkora\` a quick read.`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `itk_add:${message.webhookId ? "webhook_whitelist" : "whitelist"}:${message.author.id}`,
          )
          .setLabel("Authorize")
          .setStyle(ButtonStyle.Success),
      ),
    )
    .setAccentColor(await colorize({ avatar: entity.avatarURL, hue: Sokolors.Yellow }));

  const reply = await channel.send({
    components: [requestContainer],
    flags: ["IsComponentsV2"],
  });
  reply.createMessageComponentCollector().on("collect", async (index: ButtonInteraction) => {
    if (!index.customId.startsWith("itk_add:")) return;
    const [, targetList, userId] = index.customId.split(":", 3) as [
      undefined,
      "webhook_whitelist" | "whitelist",
      string,
    ];
    await addWhitelist(message.guildId, userId, targetList);
  });
  return;
}

async function runImport(o: ParsedImport): Promise<string> {
  const [bot, key] = o.action.specifier.split(":", 2) as [
    keyof typeof Supported,
    string | undefined,
  ];

  if (!key && bot != "MEE6") throw new InterkoraError("API key expected, nothing given");

  if (bot != "MEE6" && o.action.key === "level:rewards")
    throw new InterkoraError(`${bot} doesn’t support level rewards`);

  const leveler = buildLeveler(o.gid, key, bot);

  const content =
    o.action.key === "level:xp"
      ? await leveler.GetLeaderboard(Supported[bot])
      : await leveler.GetRewards(as<SupportedAndRewarded>(Supported[bot]));

  return o.action.operand === "c" ? codeBlock("yaml", Bun.YAML.stringify(content)) : "TODO";
}

async function runQuery(out: ParsedQueryOperand): Promise<string> {
  if (out.action.key === "reset-guild" || out.action.key === "set-guild") {
    console.warn("guild query operands leaking to interkora()");
    return "warning: guild query operands leaking to interkora()";
  }
  if (out.action.key === "set-whitelisted") {
    await addWhitelist(
      out.gid,
      out.action.specifier,
      out.action.operand === "u" ? "whitelist" : "webhook_whitelist",
    );
    return `${out.action.operand}wl+${out.action.specifier}(@${out.gid})`;
  }
  if (out.action.key === "reset-whitelisted") {
    await remWhitelist(
      out.gid,
      out.action.specifier,
      out.action.operand === "u" ? "whitelist" : "webhook_whitelist",
    );
    return `${out.action.operand}wl-${out.action.specifier}(@${out.gid})`;
  }
  if (out.action.key === "get-ent") {
    const guild = await safeGuild(client, out.gid);
    const entity = await resolveEntity(out.action.specifier, undefined, guild);
    if (!entity)
      throw new InterkoraError("Tried to query effective permissions of non-existant ID.");

    return `Entity ${entity.userId} effective permission [${entity.effectivePermissionGrant}] is ${JSON.stringify(entity.effectivePermissions, null, 2)}`;
  }
  if (out.action.key === "get-req") {
    const reqs = await getRequestors(out.gid, out.action.specifier);
    const text =
      reqs.length === 0
        ? "[]"
        : reqs
            .map(k => `${k.entity_id} ${mention(k.timestamp.valueOf(), "DETAILED_TIMESTAMP")}`)
            .join("\n");
    return text;
  }
  return "error: unknown key";
}

async function runSetter<K extends keyof TS>(o: ParsedSetter<K>): Promise<string> {
  switch (o.action.order) {
    case "set": {
      await setSetting(o.gid, o.action.key, o.action.subKey, o.action.value);

      break;
    }
    case "reset": {
      await resetSetting(o.gid, o.action.key, o.action.subKey);

      break;
    }
    case "drop": {
      await resetSettingCategory(o.gid, o.action.key);

      break;
    }
    default: {
      throw new Error("Unsupported.");
    }
  }

  return o.action.order === "drop"
    ? `DROP  "${o.action.key}" -- (*this resets the whole table!*)`
    : (o.action.order === "reset"
      ? `RESET "${o.action.key}.${o.action.subKey}"`
      : `SET   "${o.action.key}.${o.action.subKey}" TO (\n${Bun.YAML.stringify(o.action.value)}\n)`);
}

export interface ResolvedEntity {
  userId: string;
  avatarURL: string | undefined;
  hasAdminPermission: boolean;
  correspondingWhitelist: "whitelist" | "webhook_whitelist";
  effectivePermissions: Record<COMMAND, "r" | "x"> | "r" | "rw" | "rwx" | "/";
  /** Owner, Admin, Granted, Unauth… */
  effectivePermissionGrant: "o" | "a" | "g" | "u";
}

export async function resolveEntity(
  id: string,
  message: SafeMessage | undefined,
  guild: Guild,
): Promise<ResolvedEntity | undefined> {
  const userMember = message ? message.member : await safeMember(guild, id).catch(() => null);
  const webhook = message?.webhookId ? await message.fetchWebhook() : undefined;

  const member = userMember ?? webhook;
  if (!member) return;
  const avatarURL =
    (member instanceof Webhook ? member.avatarURL() : member.displayAvatarURL()) ?? undefined;
  const userId = typeof member === "string" ? member : member.id;
  const hasAdminPermission: boolean =
    member instanceof GuildMember && member.permissions.has("Administrator");
  const correspondingWhitelist = member instanceof Webhook ? "webhook_whitelist" : "whitelist";

  const whitelist = await getSetting(guild.id, "interkora", correspondingWhitelist);

  const effectivePermissionGrant =
    id === guild.ownerId ? "o" : hasAdminPermission ? "a" : whitelist.includes(id) ? "g" : "u";
  const effectivePermissions =
    effectivePermissionGrant === "o" || effectivePermissionGrant === "a"
      ? "rwx"
      : (effectivePermissionGrant === "u"
        ? "/"
        : await getEntityPermissions(guild.id, id));

  return {
    avatarURL,
    userId,
    correspondingWhitelist,
    hasAdminPermission,
    effectivePermissionGrant,
    effectivePermissions,
  };
}

const isIssue = (
  payload: InterkoraPayload | InterkoraPayloadIssue,
): payload is InterkoraPayloadIssue => Object.hasOwn(payload, "effective");

async function run<P extends AnyPayloadMember>(
  m: P[],
  client: Client,
  runner: (t: P, client: Client) => Promise<string>,
): Promise<string[]> {
  const final = [];
  for (const o of m) {
    const out = await runner(o, client);
    final.push(out);
  }

  return final;
}

const catcher = (error: unknown): InterkoraError => {
  if (error instanceof InterkoraError) return error;

  throw error; // unhandled, something broke
};

function isClean(
  outputs: [
    InterkoraError | string[],
    InterkoraError | string[],
    InterkoraError | string[],
    InterkoraError | string[],
  ],
): outputs is [string[], string[], string[], string[]] {
  return outputs.every(o => !(o instanceof InterkoraError));
}
const seqSzError = (): { ok: false; errorText: string } => {
  return {
    ok: false,
    errorText: ">10 calls of the same type.",
  };
};

/**
 * Runs Interkora for the given payload.
 *
 * @export
 * @async
 */
export async function interkora(
  payload: InterkoraPayload | InterkoraPayloadIssue,
  client: Client,
): Promise<
  | {
      ok: false;
      errorText: string;
    }
  | ({
      ok: true;
    } & Record<`${"getter" | "setter" | "import" | "query"}Output`, string[]>)
> {
  if (isIssue(payload))
    return {
      ok: false,
      errorText: "67",
    };

  if (
    payload.actualPayload.queries.length > 10 ||
    payload.actualPayload.imports.length > 10 ||
    payload.actualPayload.getters.length > 10 ||
    payload.actualPayload.setters.length > 10
  )
    return seqSzError();

  const outputs = await Promise.all([
    run(payload.actualPayload.queries, client, runQuery).catch(catcher),
    run(payload.actualPayload.imports, client, runImport).catch(catcher),
    run(payload.actualPayload.getters, client, runGetter).catch(catcher),
    run(payload.actualPayload.setters, client, runSetter).catch(catcher),
  ]);

  if (isClean(outputs))
    return {
      ok: true,
      queryOutput: outputs[0],
      importOutput: outputs[1],
      getterOutput: outputs[2],
      setterOutput: outputs[3],
    };

  // let sharedStack = "";
  let sharedMessages = "";
  for (const whatever of outputs) {
    if (!(whatever instanceof InterkoraError)) continue;
    // sharedStack += whatever.effectiveStack;
    sharedMessages += whatever.message;
  }
  return {
    ok: false,
    errorText: sharedMessages,
  };
}
