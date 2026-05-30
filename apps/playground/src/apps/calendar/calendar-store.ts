import type { StorageAdapter } from "@react-ui-os/core";

export interface CalendarEvent {
  id: string;
  /** Local calendar day, formatted YYYY-MM-DD (see dateKey in index.tsx). */
  dateKey: string;
  title: string;
  createdAt: number;
}

const STORAGE_KEY = "calendar-events";

/**
 * Storage-backed event list, modeled on the recents store: pure functions over
 * a StorageAdapter so any caller can read or mutate the list without a React
 * tree, and every write goes through the adapter's change bus so subscribers
 * (the Calendar window, other tabs) refresh live.
 */
export function listEvents(storage: StorageAdapter): CalendarEvent[] {
  const raw = storage.get<CalendarEvent[]>(STORAGE_KEY);
  return Array.isArray(raw) ? raw : [];
}

export function eventsOn(storage: StorageAdapter, dateKey: string): CalendarEvent[] {
  return listEvents(storage)
    .filter((e) => e.dateKey === dateKey)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addEvent(
  storage: StorageAdapter,
  dateKey: string,
  title: string,
): CalendarEvent | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const next: CalendarEvent = {
    id: newId(),
    dateKey,
    title: trimmed,
    createdAt: Date.now(),
  };
  storage.set(STORAGE_KEY, [...listEvents(storage), next]);
  return next;
}

export function deleteEvent(storage: StorageAdapter, id: string): void {
  storage.set(
    STORAGE_KEY,
    listEvents(storage).filter((e) => e.id !== id),
  );
}

export const CALENDAR_STORAGE_KEY = STORAGE_KEY;
