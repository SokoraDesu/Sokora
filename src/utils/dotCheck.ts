/**
 * Checks if there is or not a profile picture/emoji to the side, to add (or not) a "•" dot.
 * @param options - Options.
 * @returns String to be placed aside.
 */
export function dotCheck(options: {
  string: string | undefined | null;
  includeString?: boolean;
  doubleSpace?: boolean;
  twoSides?: boolean;
}): string {
  const { string, includeString, doubleSpace, twoSides } = options;
  const space = doubleSpace ? "  " : " ";
  const leftSide = twoSides ? space : "";
  return string ? `${includeString ? `${string}${leftSide}` : leftSide}•${space}` : "";
}
