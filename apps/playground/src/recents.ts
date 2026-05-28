import type { StorageAdapter } from "@react-ui-os/core";

export interface RecentEntry {
  id: string;
  name: string;
  kind: string;
  createdAt: number;
}

const STORAGE_KEY = "recents";

/**
 * Minimal storage-backed list used by the Recents demo folder. Demonstrates
 * the state-earned-folder pattern: the desktop icon for Recents only shows
 * up once at least one entry has been written, because the system folder
 * declares `appearsAsDesktopIcon` as a predicate that asks the storage
 * adapter whether any entries exist.
 */
export function listRecents(storage: StorageAdapter): RecentEntry[] {
  const raw = storage.get<RecentEntry[]>(STORAGE_KEY);
  return Array.isArray(raw) ? raw : [];
}

export function hasRecents(storage: StorageAdapter): boolean {
  return listRecents(storage).length > 0;
}

export function addRecent(
  storage: StorageAdapter,
  entry: Omit<RecentEntry, "id" | "createdAt">,
): RecentEntry {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
  const next: RecentEntry = {
    id,
    createdAt: Date.now(),
    ...entry,
  };
  storage.set(STORAGE_KEY, [next, ...listRecents(storage)]);
  return next;
}

export function deleteRecent(storage: StorageAdapter, id: string): void {
  storage.set(
    STORAGE_KEY,
    listRecents(storage).filter((e) => e.id !== id),
  );
}

export function renameRecent(
  storage: StorageAdapter,
  id: string,
  name: string,
): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  storage.set(
    STORAGE_KEY,
    listRecents(storage).map((e) => (e.id === id ? { ...e, name: trimmed } : e)),
  );
}

export function clearRecents(storage: StorageAdapter): void {
  storage.remove(STORAGE_KEY);
}

export const RECENTS_STORAGE_KEY = STORAGE_KEY;
