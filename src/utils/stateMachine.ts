/**
 * Gives you a Map that’s easier to manage and safely typed.
 */
export class StateTracker<T> {
  #map: Map<string, T>;

  constructor() {
    this.#map = new Map<string, T>();
  }

  public get(key: string): T | undefined {
    return this.#map.get(key);
  }

  public update(key: string, callback: (previous: T | undefined) => T | undefined): T | undefined {
    const value = this.#map.get(key);
    const newValue = callback(value);
    if (!newValue) return undefined;
    this.#map.set(key, newValue);
    return newValue;
  }

  public set(key: string, value: T): T {
    this.#map.set(key, value);
    return value;
  }

  public delete(key: string): boolean {
    return this.#map.delete(key);
  }

  public clear(): void {
    this.#map.clear();
  }

  public exists(key: string): boolean {
    return this.#map.has(key);
  }
}
