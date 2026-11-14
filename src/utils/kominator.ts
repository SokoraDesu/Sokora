/**
 * Splits a string using commas.
 * @param string - String to split.
 * @returns An array of strings from the original string.
 */
export function kominator(string: string | undefined): string[] {
  if (!string || string.trim() == "") return [];
  const returnValue = string.split(",").map(string_ => string_.replaceAll('"', "").trim());
  return returnValue.filter(Boolean);
}

/**
 * Joins an array using commas.
 * @param strings - Array to join.
 * @param shouldList - List the contents of the array like a list, e.g "a, b, c and d"
 * @returns A string with all elements of the array, joined.
 */
export function dekominator(strings: string[], shouldList?: boolean): string {
  return shouldList
    ? strings
        .map(string_ => string_.trim())
        .join(", ")
        .replaceAll(/,(?=[^,]*$)/g, " and")
    : strings.map(string_ => string_.trim()).join(",");
}
