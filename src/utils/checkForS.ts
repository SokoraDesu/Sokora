/**
 * Checks if the text provided (preferrably a name) ends with the letter S to later add either ’ or ’s to it.
 *
 * @param name - The name to check.
 * @returns Returns the name with ’ or ’s.
 */
export function checkForS(name: string): string {
  return name.toLowerCase().endsWith("s") ? `${name}’` : `${name}’s`;
}
