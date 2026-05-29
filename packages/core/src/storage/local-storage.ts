import type { StorageAdapter } from "./types";

const CHANGE_EVENT = "react-ui-os:storage-changed";

interface ChangeDetail {
  key: string;
}

/**
 * Default storage adapter, backed by `window.localStorage`. Writes dispatch
 * a CustomEvent so any in-tab listeners can react; the native `storage`
 * event handles cross-tab updates.
 *
 * SSR-safe: when `window` is unavailable, all methods are no-ops returning
 * `null` / nothing. Subscriptions return a no-op unsubscribe.
 */
export function createLocalStorageAdapter(prefix: string = "rui-os"): StorageAdapter {
  const fullKey = (k: string) => `${prefix}:${k}`;
  const stripPrefix = (k: string) =>
    k.startsWith(`${prefix}:`) ? k.slice(prefix.length + 1) : k;

  return {
    get<T = unknown>(key: string): T | null {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(fullKey(key));
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    set<T>(key: string, value: T): void {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(fullKey(key), JSON.stringify(value));
        window.dispatchEvent(
          new CustomEvent<ChangeDetail>(CHANGE_EVENT, {
            detail: { key },
          }),
        );
      } catch {
        // Swallow quota / serialization errors so a single bad write doesn't
        // tear down the desktop. Consumers can write a custom adapter for
        // stricter behavior.
      }
    },
    remove(key: string): void {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(fullKey(key));
      window.dispatchEvent(
        new CustomEvent<ChangeDetail>(CHANGE_EVENT, {
          detail: { key },
        }),
      );
    },
    subscribe(listener) {
      if (typeof window === "undefined") return () => {};
      const handleCustom = (e: Event) => {
        const detail = (e as CustomEvent<ChangeDetail>).detail;
        if (detail && typeof detail.key === "string") listener(detail.key);
      };
      const handleStorage = (e: StorageEvent) => {
        if (e.key && e.key.startsWith(`${prefix}:`)) {
          listener(stripPrefix(e.key));
        }
      };
      window.addEventListener(CHANGE_EVENT, handleCustom);
      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener(CHANGE_EVENT, handleCustom);
        window.removeEventListener("storage", handleStorage);
      };
    },
  };
}
