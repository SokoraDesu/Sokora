import { type Interaction } from "discord.js";

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
  | "OBJECT"
  | "REWARD";

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
  REWARD: string;
}[T];

export type TypeOfDefinition<T extends TableDefinition> = {
  [K in keyof T["definition"]]: SqlType<T["definition"][K]>;
};

// If it returns a string (error), then the precondition failed
export type SettingPrecondition<T extends FieldData> = (
  interaction: Interaction,
  newValue: SqlType<T>,
) => Promise<string | undefined>;

export type SingleSettingDefinition = {
  desc: string;
  val?: unknown;
  precondition?: SettingPrecondition<never>;
  iterable?: boolean;
  emoji?: string;
} & (
  | {
      type: Exclude<FieldData, "SELECT" | "OBJECT">;
    }
  | {
      type: "SELECT";
      choices: string[];
    }
  | {
      type: "OBJECT";
      settings: Record<
        string,
        SingleSettingDefinition & {
          settings?: Record<string, Omit<SingleSettingDefinition, "settings">>;
        }
      >;
    }
);

export type SettingsDefinition = Record<
  string,
  {
    description: string;
    settings: Record<string, SingleSettingDefinition>;
  }
>;

export interface LevelReward {
  id: string;
  level: number;
  channel: boolean;
}
