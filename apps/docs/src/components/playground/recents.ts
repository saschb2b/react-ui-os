import type { StorageAdapter } from "@react-ui-os/core";

export interface RecentEntry {
  id: string;
  name: string;
  kind: string;
  createdAt: number;
}

export const RECENTS_STORAGE_KEY = "recents";

export function listRecents(storage: StorageAdapter): RecentEntry[] {
  const raw = storage.get<RecentEntry[]>(RECENTS_STORAGE_KEY);
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
  const next: RecentEntry = { id, createdAt: Date.now(), ...entry };
  storage.set(RECENTS_STORAGE_KEY, [next, ...listRecents(storage)]);
  return next;
}

export function deleteRecent(storage: StorageAdapter, id: string): void {
  storage.set(
    RECENTS_STORAGE_KEY,
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
    RECENTS_STORAGE_KEY,
    listRecents(storage).map((e) =>
      e.id === id ? { ...e, name: trimmed } : e,
    ),
  );
}
