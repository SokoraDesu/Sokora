import type { SingleSettingDefinition } from "database/types";
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
 * Outputs the given setting's type with human formatting applied.
 * @param {SingleSettingDefinition} def Setting definition.
 */
export function humanizeSettingType(def: SingleSettingDefinition): string {
  const { type } = def;
  const isOptional = type.startsWith("m");
  let typeString;

  if (type == "BOOL") typeString = "boolean";
  else if (type == "INTEGER" || type == "mINTEGER") typeString = "number";
  else if (type == "SELECT") typeString = `any of: ${def.choices.map(s => `\`${s}\``).join(", ")}`;
  else typeString = type.toLowerCase();
  return isOptional ? `${typeString} (optional)` : typeString;
}
