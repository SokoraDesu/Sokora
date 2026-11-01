/**
 * Mimics `Array#map` but for Sets, i.e. runs the callback for each value in the Set and returns a new Set with the results.
 *
 * Creates a new Set into memory. Can be asked to return an Array instead. Preserves order.
 *
 * @param set - Set to map
 * @param callback - Callback to the map
 * @param haveArray - If true, returns an Array rather than a Set
 * @returns Mapped set
 */
export function setMap<T, U>(set: Set<T>, callback: (value: T) => U, haveArray: true): U[];
export function setMap<T, U>(set: Set<T>, callback: (value: T) => U, haveArray?: false): Set<U>;
export function setMap<T, U>(
  set: Set<T>,
  callback: (value: T) => U,
  haveArray?: boolean,
): Set<U> | U[] {
  if (haveArray) {
    const result = Array.from(set, value => callback(value));
    return result;
  }
  const result = new Set<U>();
  for (const value of set) result.add(callback(value));
  return result;
}
