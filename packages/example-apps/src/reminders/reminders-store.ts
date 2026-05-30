import type { StorageAdapter } from "@react-ui-os/core";

export interface Reminder {
  id: string;
  title: string;
  completed: boolean;
  flagged: boolean;
  createdAt: number;
}

const STORAGE_KEY = "reminders";

/**
 * Storage-backed reminder list, modeled on the recents store: pure functions
 * over a StorageAdapter so any caller can read or mutate the list without a
 * React tree, and every write goes through the adapter's change bus so
 * subscribers (the Reminders window, other tabs) refresh live.
 */
export function listReminders(storage: StorageAdapter): Reminder[] {
  const raw = storage.get<Reminder[]>(STORAGE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addReminder(storage: StorageAdapter, title: string): Reminder | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const next: Reminder = {
    id: newId(),
    title: trimmed,
    completed: false,
    flagged: false,
    createdAt: Date.now(),
  };
  // New reminders append to the bottom, matching the macOS Reminders order
  // where a fresh entry lands at the end of the active list.
  storage.set(STORAGE_KEY, [...listReminders(storage), next]);
  return next;
}

export function toggleComplete(storage: StorageAdapter, id: string): void {
  storage.set(
    STORAGE_KEY,
    listReminders(storage).map((r) =>
      r.id === id ? { ...r, completed: !r.completed } : r,
    ),
  );
}

export function toggleFlag(storage: StorageAdapter, id: string): void {
  storage.set(
    STORAGE_KEY,
    listReminders(storage).map((r) =>
      r.id === id ? { ...r, flagged: !r.flagged } : r,
    ),
  );
}

export function renameReminder(
  storage: StorageAdapter,
  id: string,
  title: string,
): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  storage.set(
    STORAGE_KEY,
    listReminders(storage).map((r) => (r.id === id ? { ...r, title: trimmed } : r)),
  );
}

export function deleteReminder(storage: StorageAdapter, id: string): void {
  storage.set(
    STORAGE_KEY,
    listReminders(storage).filter((r) => r.id !== id),
  );
}

export function clearCompleted(storage: StorageAdapter): void {
  storage.set(
    STORAGE_KEY,
    listReminders(storage).filter((r) => !r.completed),
  );
}

export const REMINDERS_STORAGE_KEY = STORAGE_KEY;
