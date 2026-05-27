import type { ClientEvents } from "discord.js";

export type Event<K extends keyof ClientEvents> = (...arguments_: ClientEvents[K]) => unknown;

export type Mentionable =
  | "USER"
  | "ROLE"
  | "CHANNEL"
  | "DEFAULT_TIMESTAMP"
  | "SIMPLE_TIMESTAMP"
  | "DETAILED_TIMESTAMP";

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

/**
 * Force typescript to recognize a variable as a certain type (useful for polymorphic const variables for example)
 * @param v The variable you want to force the type of
 * @returns true (the variable is now of the type specified in `<T>`)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
export function forceType<T>(v: any): v is T {
  return true;
}
