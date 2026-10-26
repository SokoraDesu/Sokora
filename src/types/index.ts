import type { Channel, ContainerBuilder, Interaction, PermissionFlagsBits } from "discord.js";
import { getSettingDef, type TS } from "database/settings";
import type {
  ChatInputCommandInteraction,
  ClientEvents,
  Guild,
  GuildMember,
  Message,
  TextBasedChannel,
  User,
} from "discord.js";
import type { ModType } from "database/moderation";

/// GENERAL TYPES

export type Event<K extends keyof ClientEvents> = (...arguments_: ClientEvents[K]) => unknown;

export type Mentionable =
  "USER" | "ROLE" | "CHANNEL" | "DEFAULT_TIMESTAMP" | "SIMPLE_TIMESTAMP" | "DETAILED_TIMESTAMP";

export type ReplaceableStrings =
  | "(name)"
  | "(username)"
  | "(count)"
  | "(servername)"
  | "(serverowner)"
  | "(currentdate)"
  | "(currentdate, simple)"
  | "(currentdate, detailed)";

export type Replacements = { text: ReplaceableStrings; replacement: string | number }[];

export type Satisfies<K, T extends K> = T;

export interface Mention {
  type: "USER" | "ROLE" | "CHANNEL" | "TIMESTAMP";
  res: string;
}

/**
 * Force TypeScript to recognize a variable as a certain type *in place*. Useful for polymorphic const variables, for example.
 * @param _v The variable you want to force the type of
 * @returns The variable, now of the type specified in `<T>`
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
export function as<T>(v: any): T {
  return v as T;
}

export type SafeChatInteraction = ChatInputCommandInteraction & {
  guild: Guild & {
    members: Guild["members"] & {
      me: GuildMember;
    };
  };
  guildId: string;
  user: User;
  channel: TextBasedChannel;
};

/**
 * Type-checks that the interaction is usable and **properly** tells the compiler about it.
 *
 * @param {ChatInputCommandInteraction} interaction Any command interaction to check for.
 * @returns True if it is usable, false otherwise.
 * @throws {Error} If it’s unsafe, it throws. Handle accordingly.
 */
export function assertInteraction(
  interaction: ChatInputCommandInteraction,
): asserts interaction is SafeChatInteraction {
  if (
    !interaction.guild ||
    !interaction.guildId ||
    !interaction.user ||
    !interaction.channel ||
    !interaction.guild.members.me
  )
    throw new Error(
      `Interaction ${interaction.id} (createdAt ${interaction.createdAt}, guildId ${interaction.guildId}, user ${interaction.user.id}) is unsafe.`,
    );

  return;
}

export type SafeMessage = Message & {
  guild: Guild;
  guildId: string;
  partial: false;
};

/**
 * Type-checks that the message is usable and **properly** tells the compiler about it.
 *
 * You’re expected to not use this directly, though. `safeMessage()` calls this internally.
 *
 * **Throws if the message is a DM / not in a guild.**
 *
 * @see `safeMessage` from safeThings.
 * @param {Message} message Any type of message to check for.
 * @returns True if it is usable, false otherwise.
 * @throws {Error} If it’s unsafe, it throws. Handle accordingly.
 */
export function assertMessage(message: Message): asserts message is SafeMessage {
  if (message.partial)
    throw new Error(
      `Message ${message.id} (by ${message.author.username}:${message.author.id} at ${message.channelId}) was asserted while still being partial. A dev forgot to fetch it.`,
    );

  if (!message.guild || !message.guildId)
    throw new Error(
      `Message ${message.id} (by ${message.author.id} at ${message.channelId}) is unsafe.`,
    );

  return;
}

export interface GHCommit {
  sha: string;
  html_url: string;
  commit: {
    author: null | {
      name?: string;
      email?: string;
      date?: string;
    };
    message: string;
  };
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
}

/// MODERATION TYPES

// todo: review shape
export type ModActionPayload = {
  guild: Guild;
  moderator: User;
  duration?: number;
  shouldDm?: boolean;
  expiresAt?: Date;
  previousCaseId?: number;
} & (
  | {
      action: Exclude<ModType, "CLEAR" | "LOCK" | "UNLOCK" | "SLOWDOWN">;
      target: User;
      channel?: Channel;
      isSilent: boolean;
    }
  | {
      action: "CLEAR" | "LOCK" | "UNLOCK" | "SLOWDOWN";
      target?: undefined;
      channel: Channel;
    }
);

export const enum ModErrorCode {
  CaseDoesNotExist,
  CantModerateSokora,
  ModeratorNotFound,
  AlreadyBanned,
  AlreadyUnbanned,
  TargetNotFound,
  NotApiModeratable,
  MissingPermission,
  RolePosSame,
  ChannelDoesNotExist,
  TargetRolePosHigher,
  TargetOutside,
  CantModerateSelf,
}

export type ModError =
  | {
      code: ModErrorCode.MissingPermission;
      permissions: (keyof typeof PermissionFlagsBits)[];
    }
  | {
      code: Exclude<ModErrorCode, ModErrorCode.MissingPermission>;
    };

export function isModError(error: unknown): error is ModError {
  return (
    error != null &&
    typeof error == "object" &&
    Object.hasOwn(error, "code") &&
    !Object.hasOwn(error, "url")
  );
}

export function isModErroryResult(error: unknown): error is ModActionResult {
  return (
    error != null &&
    typeof error == "object" &&
    Object.hasOwn(error, "error") &&
    (error as { error: unknown }).error != null
  );
}

export type ModActionResult = ModActionPayload & {
  error: null | ModError | Error;
  caseId: number;
  previousCaseId?: number;
  title: string;
  reason: string | null;
};

export type ModErrorOptions = Partial<ModActionPayload> & {
  errorOptions: {
    allErrors: boolean;
    botError: boolean;
    channelError?: boolean;
    outsideError?: boolean;
    banCheckError?: boolean;
  };
};

export type ModEmbedOptions = ModActionResult & {
  isSilent?: boolean;
  reason?: string | null;
  customText?: {
    logTitle: string;
    dmTitle?: string;
  };
};

/// FEATURE TYPES

export interface FeatureError {
  title: string;
  reason?: string;
}

/**
 * All valid feature names.
 *
 * Yes, this union type is manually maintained. Not ideal, but considering we don’t add features every single day it’s reasonable enough. If you add a feature, make sure to add it here too.
 */
export type FeatureName =
  | `games/${"rps" | "coin"}`
  | `math/${"calc" | "graph"}`
  | `mod/${"ban" | "unban" | "mute" | "unmute" | "kick" | "lock" | "unlock" | "warn" | "slowdown" | "delwarn" | "clear"}`
  | `news/${"edit" | "remove" | "view" | "post"}`;

export interface PrimitiveFeatureSuccess<S> {
  success: true;
  feature: FeatureName;
  out: S;
}

export interface PrimitiveFeatureError<F = FeatureError> {
  success: false;
  reason: "user" | "exception";
  feature: FeatureName;
  out: F;
}

/**
 * Output of using a feature.
 */
export type FeatureOutput<S, F = FeatureError> =
  PrimitiveFeatureSuccess<S> | PrimitiveFeatureError<F>;

/**
 * Output of using an app-only feature (i.e., one that isn’t usable through API, just the Discord client). This means it can (and will) return a `ContainerBuilder` as the success output.
 */
export type AppOnlyFeatureOutput = FeatureOutput<ContainerBuilder>;

/// DATABASE TYPES

export type FieldData =
  | "TEXT"
  | "mTEXT"
  | "INTEGER"
  | "mINTEGER"
  | "BOOL"
  | "TIMESTAMP"
  | "mTIMESTAMP"
  | "CHANNEL"
  | "mCHANNEL"
  | "USER"
  | "mUSER"
  | "ROLE"
  | "mROLE"
  | "SELECT"
  | "OBJECT";

export interface TableDefinition {
  name: string;
  definition: Record<string, FieldData>;
}

type Maybe<T> = T | undefined;

export type SqlType<T extends FieldData> = {
  BOOL: boolean;
  INTEGER: number;
  mINTEGER: Maybe<number>;
  TEXT: string;
  mTEXT: Maybe<string>;
  TIMESTAMP: Date;
  mTIMESTAMP: Maybe<Date>;
  CHANNEL: string;
  mCHANNEL: Maybe<string>;
  USER: string;
  mUSER: Maybe<string>;
  ROLE: string;
  mROLE: Maybe<string>;
  SELECT: string;
  OBJECT: string;
}[T];

export type SqlObjectType<T extends Record<string, SingleSettingDefinition>> = {
  [K in keyof T]: T[K] extends {
    type: "OBJECT";
    properties: infer P extends Record<string, SingleSettingDefinition>;
  }
    ? SqlObjectType<P>
    : T[K] extends { iterable: true }
      ? SqlType<T[K]["type"]>[]
      : SqlType<T[K]["type"]>;
};

export type TypeOfDefinition<T extends TableDefinition> = {
  [K in keyof T["definition"]]: SqlType<T["definition"][K]>;
};

export type SettingPrecondition<T extends SettingSettableValue> = (
  interaction: Interaction,
  newValue: T, // Do we keep this arg ? used for example for boolean buttons to only trigger the precondition message when it's toggled on
) => Promise<string | undefined>;

interface SettingBase {
  /**
  Description of the setting.
  */
  desc: string;
  /**
  Default value, `undefined` if unset.
  */
  val?: SettingSettableValue;
  /**
  If true, the setting holds an array of values rather than a single one.
  */
  iterable?: boolean;
  /**
  Emoji that represents the setting, used in SE.
  */
  emoji?: string;
}

interface PreconditionBase<T extends SettingSettableValue> {
  /**
  Validation function that should run before setting a value. Returns either a `string` (error message; fail) or undefined (success).
  */
  precondition?: SettingPrecondition<T>;
}

type SelectSetting = SettingBase & {
  type: "SELECT";
  /**
  List of available choices for the select menu.
  */
  choices: string[];
} & PreconditionBase<string[]>;

type ObjectBase = SettingBase & {
  type: "OBJECT";
  /**
  Named properties for the OBJECT setting.
  */
  properties: Record<string, SingleSettingDefinition>;
  /**
  Validation callback for the OBJECT list. Returns a boolean if the user set the OBJECT up properly.
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation?: (a: any) => boolean;
} & PreconditionBase<undefined>;

export interface SingleObjectSetting extends ObjectBase {
  iterable: false;
}

export interface IterableObjectSetting extends ObjectBase {
  iterable: true;
  /**
  Sorting callback for the OBJECT list. Passed to `Array#toSorted`.
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sorting: (a: any, b: any) => number;
  /**
  Naming callback for the OBJECT list. An OBJECT is passed to it and it should return a string representation.
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  naming: (a: any) => string;
}

type PrimitiveSetting<K extends Exclude<FieldData, "SELECT" | "OBJECT">> = {
  type: K;
} & SettingBase &
  PreconditionBase<SqlType<K>>;

export type SingleSettingDefinition =
  | SelectSetting
  | SingleObjectSetting
  | IterableObjectSetting
  | PrimitiveSetting<"TEXT" | "mTEXT" | "INTEGER" | "mINTEGER">
  | PrimitiveSetting<"BOOL">
  | PrimitiveSetting<"TIMESTAMP" | "mTIMESTAMP">
  | PrimitiveSetting<"CHANNEL" | "mCHANNEL">
  | PrimitiveSetting<"USER" | "mUSER">
  | PrimitiveSetting<"ROLE" | "mROLE">;

export interface SettingDefinitionRecord {
  description: string;
  settings: Record<string, SingleSettingDefinition>;
}

type BaseSettingSettableValue = string | boolean | number | Date | undefined;
export type SettingSettableValue = BaseSettingSettableValue | BaseSettingSettableValue[];

type BaseSettingValueFromDef<T extends SingleSettingDefinition> = T extends { iterable: true }
  ? (T extends { type: "OBJECT" } ? SqlObjectType<T["properties"]> : SqlType<T["type"]>)[]
  : T extends { type: "OBJECT" }
    ? SqlObjectType<T["properties"]>
    : T extends { val: SettingSettableValue }
      ? NonNullable<SqlType<T["type"]>>
      : SqlType<T["type"]>;

export type SettingValueFromDef<T extends SingleSettingDefinition> =
  T["type"] extends Uppercase<T["type"]>
    ? T extends { val: SettingSettableValue }
      ? BaseSettingValueFromDef<T>
      : T extends { iterable: true }
        ? BaseSettingValueFromDef<T>
        : BaseSettingValueFromDef<T> | undefined
    : BaseSettingValueFromDef<T> | undefined;

export type SettingsFor<K extends keyof TS> = TS[K]["settings"];

export type SettingKeyFor<K extends keyof TS> = keyof TS[K]["settings"] & string;

export type Setting<K extends keyof TS, S extends SettingKeyFor<K>> = SingleSettingDefinition &
  TS[K]["settings"][S];

export type GuidParameter<T extends SingleSettingDefinition> = T extends { type: "OBJECT" }
  ? string
  : never;

export type SettingReturnType<K extends keyof TS, S extends SettingKeyFor<K>> = SettingValueFromDef<
  Setting<K, S>
>;

export type ParameterReturnType<
  K extends keyof TS,
  S extends SettingKeyFor<K>,
  P extends SettingReturnType<K, S>,
> = P extends readonly (infer T)[] ? T : never;

export type BulkedSettingReturnType<K extends keyof TS> = {
  [S in SettingKeyFor<K>]: SettingValueFromDef<Setting<K, S>>;
};

/** Called "glue fix" because after some (tiny to be fair) research I'm starting to think that the Sokora type system goes beyond LANGUAGE LIMITATIONS (LMFAO).
 *
 * For reference: Where I'm using this, WHATEVER I DO, the TypeScript compiler fails to infer the types, even if I make the definition oddly explicit (to the point you'd see that code and call it a "glue fix" anyway). It genuinely needs this type assertion to function properly.
 */
export type SettingsGlueFix1<
  K extends keyof TS,
  S extends SettingKeyFor<K>,
> = SingleSettingDefinition & { val?: SettingReturnType<K, S> };

/**
 * Validates a value against its setting definition. Does not check preconditions.
 *
 * For objects or iterables, it deeply checks every value.
 *
 * Lacks generic typing (due to how hard it is to make it work...), assert types yourself.
 *
 * Also, when validating iterable settings, it expects an array. If validating a single entry, wrap it in `[]` so it works.
 *
 * @param value Value to validate
 * @param def Definition to validate against.
 * @returns `true` if everything is valid, false otherwise.
 */
export function isSettingValueValid<K extends keyof TS, S extends SettingKeyFor<K>>(
  value: unknown,
  config: {
    key: K;
    setting: S;
    def?: SingleSettingDefinition;
  },
): value is SettingReturnType<K, S> {
  const def = config.def ?? getSettingDef(config.key, config.setting);
  const isOptional = def.type.startsWith("m");

  if (def.iterable) {
    const isArray = Array.isArray(value);
    if (isOptional && (value === undefined || (isArray && value.length > 0))) return true;
    if (isArray && !(def.type === "OBJECT" && def.validation?.(value[0])))
      return value.every(v => {
        return isSettingValueValid(v, {
          key: config.key,
          setting: config.setting,
          def: { ...def, iterable: false },
        });
      });

    return false;
  }

  if (typeof value === "object" || (value === undefined && isOptional)) return true;

  switch (def.type) {
    case "OBJECT": {
      if (typeof value !== "object" || value === null) return false;

      const objectValue = value as Record<string, SettingSettableValue>;
      for (const [property, propertyDefinition] of Object.entries(def.properties)) {
        if (property == "$") continue;
        if (
          (!Object.hasOwn(objectValue, property) && !propertyDefinition.type.startsWith("m")) ||
          !isSettingValueValid(objectValue[property], {
            key: config.key,
            setting: config.setting,
            def: propertyDefinition,
          })
        )
          return false;
      }
      return true;
    }
    case "BOOL": {
      return typeof value === "boolean";
    }
    case "INTEGER":
    case "mINTEGER": {
      return (
        typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value)))
      );
    }
    case "mUSER":
    case "USER":
    case "ROLE":
    case "mROLE":
    case "CHANNEL":
    case "mCHANNEL": {
      // can't validate they IDs on its own, use safeThings for that; this just checks format (numeric string)
      // https://stackoverflow.com/questions/175739/how-can-i-check-if-a-string-is-a-valid-number
      return typeof value === "string";
    }
    case "SELECT": {
      return typeof value === "string" && def.choices.includes(value);
    }
    case "TEXT":
    case "mTEXT": {
      return typeof value === "string" && (isOptional || value.trim().length > 0);
    }
    case "TIMESTAMP":
    case "mTIMESTAMP": {
      return (
        typeof value == "string" && (/<t:\d+:[tTdDfFsSR]>/gm.test(value) || /<t:\d+>/gm.test(value))
      );
    }
    default: {
      // unreachable, exists for the compiler's sake and happiness
      return false;
    }
  }
}
