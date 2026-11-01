/**
 * Randomizes array values.
 * @param array - Array to randomize.
 * @returns Randomized value from within the array.
 */
export function randomize<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
