import type { Interaction } from "discord.js";
import { getSettingDef, type TS } from "./settings";

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

export type SettingPrecondition<T extends FieldData> = (
  interaction: Interaction,
  newValue: SqlType<T>,
) => Promise<string | undefined>;

interface SettingBase {
  /** Description of the setting. */
  desc: string;
  /** Default value, `undefined` if unset. */
  val?: SettingSettableValue;
  /** If true, the setting holds an array of values rather than a single one. */
  iterable?: boolean;
  /** Emoji that represents the setting, used in SE. */
  emoji?: string;
}

interface PreconditionBase<F extends FieldData> {
  /** Validation function that should run before setting a value. Returns either a `string` (error message; fail) or undefined (success). */
  precondition?: SettingPrecondition<F>;
}

type SelectSetting = SettingBase & {
  type: "SELECT";
  /** List of available choices for the select menu. */
  choices: string[];
} & PreconditionBase<"SELECT">;

type ObjectBase = SettingBase & {
  type: "OBJECT";
  /** Named properties for the OBJECT setting. */
  properties: Record<string, SingleSettingDefinition>;
} & PreconditionBase<"OBJECT">;

export interface SingleObjectSetting extends ObjectBase {
  iterable?: false | undefined;
}

export interface IterableObjectSetting extends ObjectBase {
  iterable: true;
  /** Sorting callback for the OBJECT list. Passed to `Array#toSorted`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sorting: (a: any, b: any) => number;
  /** Naming callback for the OBJECT list. An OBJECT is passed to it and it should return a string representation. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  naming: (a: any) => string;
  /** Validation callback for the OBJECT list. Returns a boolean if the user set the OBJECT up properly. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation?: (a: any) => boolean;
}

type PrimitiveSetting<K extends Exclude<FieldData, "SELECT" | "OBJECT">> = {
  type: K;
} & SettingBase &
  PreconditionBase<K>;

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
    if (!isArray) return false;
    if (def.type === "OBJECT" && def.validation?.(value[0])) return false;

    return value.every(v =>
      isSettingValueValid(v, {
        key: config.key,
        setting: config.setting,
        def: { ...def, iterable: false },
      }),
    );
  }

  if (typeof value === "object" || (value === undefined && isOptional)) return true;

  switch (def.type) {
    case "OBJECT": {
      if (typeof value !== "object" || value === null) return false;

      const objectValue = value as Record<string, SettingSettableValue>;
      for (const [property, propertyDefinition] of Object.entries(def.properties)) {
        if (property == "$") continue;
        if (!Object.hasOwn(objectValue, property) && !propertyDefinition.type.startsWith("m"))
          return false;

        if (
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
