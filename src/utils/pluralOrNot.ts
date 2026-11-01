import { replace } from "./replace";

/**
 * If abs of `numberToCheck` isn't 1, `word` is made plural and returned, otherwise `word` is returned untouched.
 * @param word - Word to pluralize.
 * @param numberToCheck - Number to check.
 * @returns Pluralized (or not) string.
 */
export function pluralOrNot(word: string, numberToCheck: number): string {
  return Math.abs(numberToCheck) == 1
    ? word
    : replace(word, [
        {
          text: word,
          replacement: word.endsWith("y") ? `${word.replace("y", "")}ies` : `${word}s`,
        },
      ]);
}
