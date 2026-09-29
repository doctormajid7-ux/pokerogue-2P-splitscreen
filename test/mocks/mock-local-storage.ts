/**
 * A minimal but faithful `Storage` implementation for tests.
 *
 * `PlayerStorage` (the single door to game storage) enumerates keys through
 * `length`/`key(index)` and distinguishes a missing key (`null`) from an empty
 * value (`""`), exactly like a browser's `localStorage` — so the stub has to
 * behave the same way.
 */
export const mockLocalStorage = (): Storage => {
  const store = new Map<string, string>();

  const storage = {
    get length() {
      return store.size;
    },

    key: (index: number) => [...store.keys()][index] ?? null,

    getItem: (key: string) => store.get(key) ?? null,

    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },

    removeItem: (key: string) => {
      store.delete(key);
    },

    clear: () => {
      store.clear();
    },

    /** Kept for callers written against the plain-object stub. */
    hasOwnProperty: (key: string) => store.has(key),
  };

  return storage as unknown as Storage;
};
