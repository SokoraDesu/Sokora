export type FieldData =
  | "TEXT"
  | "INTEGER"
  | "BOOL"
  | "TIMESTAMP"
  | "CHANNEL"
  | "USER"
  | "ROLE"
  | "COMMAND"
  | "LIST";

export type TableDefinition = {
  name: string;
  definition: Record<string, FieldData>;
};

export type SqlType<T extends FieldData> = {
  BOOL: boolean;
  INTEGER: number;
  TEXT: string;
  TIMESTAMP: Date;
  CHANNEL: string;
  USER: string;
  ROLE: string;
  COMMAND: string;
  LIST: any[];
}[T];

export type TypeOfDefinition<T extends TableDefinition> = {
  [K in keyof T["definition"]]: SqlType<T["definition"][K]>;
};
