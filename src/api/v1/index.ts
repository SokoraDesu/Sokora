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
  type User,
  type NewsChannel,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type StageChannel,
  type TextChannel,
  type VoiceChannel,
} from "discord.js";
import {
  type SettingReturnType,
  type SettingKeyFor,
  type EntityPermissions,
  PermissionGrants,
  PermissionOrigins,
  PermissionTableValue,
} from "types";
import { mention } from "utils/mention";
import { colorize, Sokolors } from "utils/colorize";
import { safeAlertChannel, safeGuild, safeMember } from "utils/safeThings";
import type { Mention, ResolvedEntity, SafeMessage } from "types";
import {
  getCase,
  listUserCases,
  listGuildCases,
  type ModTypeUserTimeless,
  type ModTypeUserTimefull,
  type ModTypeChannelTimefull,
} from "database/moderation";
import { fetchServerboard, getServerboardEntry } from "database/serverboard";
import { getGuildLeaderboard, getUserXp } from "database/leveling";
import { getLatestNews, getNews } from "database/news";
import {
  addWhitelist,
  getRequestors,
  addRequestor,
  remWhitelist,
  getRegistration,
} from "database/interkora";
import { client } from "botfile";

export const COMMANDS = ["set", "reset", "drop", "get", "query"] as const;
export type COMMAND = (typeof COMMANDS)[number];
export const GETTERS = [
  "settings",
  "leaderboard",
  "starboard",
  "serverboard",
  "cases",
  "news",
] as const;
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
  public effectiveName: ERROR_CODE;

  constructor(message: string, options?: { name?: ERROR_CODE; cause?: Error }) {
    super(message, options);
    this.name = "InterkoraError";
    this.effectiveName = options?.name ?? "InvalidSeq";
  }

  public toString(): string {
    return `${this.name} [${this.effectiveName}]: ${this.message}.`;
  }
}

export function assertOrder(o: string): asserts o is (typeof COMMANDS)[number] {
  if (typeof o === "string" && COMMANDS.includes(o as "set")) return;
  throw new InterkoraError(
    `Order **${o}** is not valid. Choose any of ${COMMANDS.map(s => `\`${s}\``).join(", ")}.`,
    { name: "InvalidOrder" },
  );
}
export function assertGetter(o: string): asserts o is (typeof GETTERS)[number] {
  if (typeof o === "string" && GETTERS.includes(o as "settings")) return;
  throw new InterkoraError(`Key **${o}** is not a getter.`, { name: "InvalidSeq" });
}
export function assertClause(o: string): asserts o is (typeof CLAUSES)[number] {
  if (typeof o === "string" && CLAUSES.includes(o as "set-guild")) return;
  throw new InterkoraError(`Key **${o}** is not a query clause.`, { name: "InvalidSeq" });
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

type AnyPayloadMember = ParsedGetter | ParsedSetter | ParsedQueryOperand;
type AnyPayloadMemberStandalone = Omit<AnyPayloadMember, "gid">;

export const isParsedGetter = (o: AnyPayloadMemberStandalone): o is Omit<ParsedGetter, "gid"> =>
  o.action.order === "get";
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

export interface ParsedModder extends Omit<ParsedSuccess, "entity"> {
  action: {
    order: "mod";
    format: SupportedRetrievalFormats;
    onBehalfOf: GuildMember;
    reason: string;
  } & (
    | ({
        operand:
          | NewsChannel
          | StageChannel
          | TextChannel
          | PublicThreadChannel
          | PrivateThreadChannel
          | VoiceChannel;
      } & (
        | {
            specifier: "UNLOCK";
          }
        | {
            specifier: "CLEAR";
            targetUserId: string | undefined;
            amount: number;
          }
        | {
            specifier: ModTypeChannelTimefull;
            timeMillisec?: number;
          }
      ))
    | ({
        operand: User;
        isSilentSuggested: boolean;
      } & (
        | {
            specifier: ModTypeUserTimeless;
          }
        | {
            specifier: ModTypeUserTimefull;
            timeMillisec?: number;
          }
      ))
  );
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
  error: false;
  actualPayload: {
    getters: ParsedGetter[];
    setters: ParsedSetter[];
    queries: ParsedQueryOperand[];
  };
}
export interface InterkoraPayloadIssue extends ParsedSuccess {
  error: true;
  effectiveStack: string;
  effectiveName: ERROR_CODE;
  member?: AnyPayloadMember;
  errorMessage?: string;
}

export const isShceduledModderCustomId = (s: string): s is `itkmod:${"y" | "n"}:${string}` =>
  /itkmod:(y|n):\w+/.test(s);

async function runGetter(getter: ParsedGetter): Promise<[SupportedRetrievalFormats, string]> {
  const guildId = getter.gid;
  const Stringify: (data: unknown) => [SupportedRetrievalFormats, string] = (data: unknown) => {
    return [
      getter.action.format,
      getter.action.format === "json" ? JSON.stringify(data) : Bun.YAML.stringify(data),
    ];
  };

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
    // TODO(v0.5): add more methods that use pure SQL instead of JS-side logic for getting things
    // and also move pagination too from JS slicing to SQL limiting
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
  entity: ResolvedEntity,
  message: SafeMessage,
): Promise<void> {
  const entityType = entity.whitelistName === "webhook_whitelist" ? "h" : "u";

  const requestors = await getRequestors(message.guildId, entityType);
  const isRequestor = requestors.some(v => v.entity_id === entity.userId);
  if (isRequestor) {
    await message.reply("You’ve already requested Interkora access.");
    return;
  }

  await addRequestor(message.guildId, entity.userId, entityType);
  const channel = await safeAlertChannel(message.guild, true);
  const reason = message.content.replace("soko$request", "").trim();
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
        `\n✅ Authorize this by typing \`soko$query set-whitelisted ${message.author.id} ${message.webhookId ? "u" : "h"}\`, or with the button below.\n❌ Deny this by doing nothing. Note they may request it again.\n\n🛡️ After allowing, deny it if desired by running \`s!query reset-whitelisted ${message.author.id} ${message.webhookId ? "u" : "h"}\`.\n\nAll these things can also be done from PSE, access it with \`/settings interkora\`.\nDoes any of this give you doubts? Give \`/help interkora\` a quick read.`,
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

    return `Entity ${entity.userId} effective permission [${entity.permissionOrigin}] is ${JSON.stringify(entity.permissions, null, 2)}`;
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
  const whitelistName = member instanceof Webhook ? "webhook_whitelist" : "whitelist";

  const isEnabled = await getSetting(guild.id, "interkora", "enabled");
  const whitelist = await getSetting(guild.id, "interkora", whitelistName);
  const isWhitelisted = whitelist.includes(id);

  let permissionOrigin: PermissionOrigins = isWhitelisted
    ? PermissionOrigins.Whitelisted
    : PermissionOrigins.None;

  if (hasAdminPermission) permissionOrigin = PermissionOrigins.Admin;

  if (id === guild.ownerId) permissionOrigin = PermissionOrigins.Owner;

  const registration = await getRegistration(id);

  let permissions: EntityPermissions =
    permissionOrigin === PermissionOrigins.None
      ? PermissionGrants.Nothing
      : (registration?.payload.requestedPermissions ?? PermissionGrants.Nothing);

  if (permissionOrigin === PermissionOrigins.Owner) permissions = PermissionGrants.Everything;
  if (permissionOrigin === PermissionOrigins.Admin) permissions = PermissionGrants.WriteAll;

  return {
    avatarURL,
    userId,
    isWhitelisted,
    isEnabled,
    whitelistName,
    whitelist,
    hasAdminPermission,
    permissionOrigin,
    permissions,
  };
}

async function run<P extends AnyPayloadMember, T>(
  m: P[],
  client: Client,
  runner: (t: P, client: Client) => Promise<T>,
): Promise<T[]> {
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
  // TODO(@ZakaHaceCosas): make this better for fucks sake
  outputs: [
    InterkoraError | string[],
    InterkoraError | [SupportedRetrievalFormats, string][],
    InterkoraError | string[],
  ],
): outputs is [string[], [SupportedRetrievalFormats, string][], string[]] {
  return outputs.every(o => !(o instanceof InterkoraError));
}

const seqSzError = (): { ok: false; errorText: string } => {
  return {
    ok: false,
    errorText: ">10 calls of the same type.",
  };
};

/**
 * Checks if an entity is actually allowed to do what it’s trying to do.
 *
 * @remarks
 * This isn’t currently async, but it’ll likely be (or add a parameter for you to give setting state).
 *
 * This is because, during testing, permission tables will be a block. You either add the integration with all permissions it asked for, or you do not add it. In the future however there’ll be permission settings, which we’ll have to read here.
 *
 * @param entity - Entity that’s running Interkora.
 * @param order - Specific order to check.
 * @returns True if it should proceed, false if no permission.
 */
export function isOrderAllowed(
  entity: ResolvedEntity,
  order: Omit<ParsedGetter | ParsedSetter, "gid" | "entity">,
): boolean {
  if (entity.permissionOrigin === PermissionOrigins.None) return false;
  if (
    entity.permissionOrigin === PermissionOrigins.Admin ||
    entity.isWhitelisted ||
    entity.permissionOrigin === PermissionOrigins.Owner
  )
    return true;

  if (entity.permissions === PermissionGrants.Nothing) return false;
  if (entity.permissions === PermissionGrants.Everything) return true;
  if (entity.permissions === PermissionGrants.ReadAll) return isParsedGetter(order);
  if (entity.permissions === PermissionGrants.WriteAll)
    return isParsedGetter(order) || isParsedSetter(order);

  if (isParsedGetter(order)) {
    // TODO: review if serverboard should have a perm entry or not
    // it is read only and its easy to gather data anyway, but ¯\_(ツ)_/¯
    if (order.action.key === "serverboard") return true;
    if (order.action.key === "cases")
      return entity.permissions.moderation === PermissionTableValue.Disabled ? false : true;

    return entity.permissions[order.action.key] === PermissionTableValue.Disabled ? false : true;
  }

  if (isParsedSetter(order)) {
    if (order.action.key === "serverboard") return true;
    return entity.permissions.settings === PermissionTableValue.Disabled ||
      entity.permissions.settings === PermissionTableValue.ReadOnly
      ? false
      : true;
  }

  return entity.permissions.moderation === PermissionTableValue.ReadWrite;
}

/**
 * Runs Interkora for the given payload.
 */
export async function interkora(
  payload: InterkoraPayload,
  client: Client,
): Promise<
  | {
      ok: false;
      errorText: string;
    }
  | {
      ok: true;
      getterOutput: [SupportedRetrievalFormats, string][];
      setterOutput: string[];
      queryOutput: string[];
    }
> {
  if (
    payload.actualPayload.queries.length > 10 ||
    payload.actualPayload.getters.length > 10 ||
    payload.actualPayload.setters.length > 10
  )
    return seqSzError();

  const outputs = await Promise.all([
    run(payload.actualPayload.queries, client, runQuery).catch(catcher),
    run(payload.actualPayload.getters, client, runGetter).catch(catcher),
    run(payload.actualPayload.setters, client, runSetter).catch(catcher),
  ]);

  if (isClean(outputs))
    return {
      ok: true,
      queryOutput: outputs[0],
      getterOutput: outputs[1],
      setterOutput: outputs[2],
    };

  let sharedMessages = "";
  for (const whatever of outputs) {
    if (!(whatever instanceof InterkoraError)) continue;
    sharedMessages += whatever.message;
  }
  return {
    ok: false,
    errorText: sharedMessages,
  };
}
