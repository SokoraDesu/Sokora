import type { FieldData } from "database/types";
import { capitalize } from "./capitalize";

/**
 * Outputs the given settings_string with formatting applied.
 * @param {string} string Settings string, either a key or a value.
 */
export function humanizeSettings(string: string): string {
  const humanized = string
    .toLowerCase()
    .trim()
    .replaceAll("_", " ")
    .replaceAll("true", "Enabled")
    .replaceAll("false", "Disabled")
    .replaceAll("(name)", "`(name)`")
    .replaceAll("(servername)", "`(servername)`")
    .replaceAll("(count)", "`(count)`")
    .replaceAll("(serverowner)", "`(serverowner)`")
    .replaceAll("(currentdate)", "`(currentdate)`")
    .replaceAll("(currentdate, simple)", "`(currentdate, simple)`")
    .replaceAll("(currentdate, detailed)", "`(currentdate, detailed)`")
    .replaceAll("dm", "DM")
    .replaceAll("xp", "XP");

  return capitalize(humanized);
}

/**
 * Outputs the given TYPE with formatting applied.
 * @param {FieldData} type Humanized type.
 */
export function humanizeType(type: FieldData): string {
  if (type == "BOOL") return "boolean";
  if (type == "REWARD") return "level reward";
  if (type == "INTEGER") return "number";
  return type.toLowerCase();
}
