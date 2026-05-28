/**
 * Abstract storage backend. The library ships a localStorage adapter and
 * accepts custom ones for products that want server-side persistence or
 * cross-device sync.
 */
export interface StorageAdapter {
  get<T = unknown>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  /**
   * Notify a listener whenever a stored value changes. Returns an unsubscribe
   * function. Listeners receive the unprefixed key.
   */
  subscribe(listener: (key: string) => void): () => void;
}
