import type { StorageAdapter } from "@react-ui-os/core";

export interface Note {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "notes";

/**
 * Storage-backed note list, modeled on the recents store: pure functions over
 * a StorageAdapter, namespaced under one key, with live updates delivered
 * through `storage.subscribe`.
 *
 * Apple Notes derives a note's title from its first non-empty line rather than
 * storing a separate title field; we follow that, so the body is the single
 * source of truth and the title is computed (see `noteTitle`).
 * Source: Apple Support, "Format notes in Notes on Mac" (the first line of a
 * note becomes its title) and the default "first line is Title" style.
 * The list is sorted by most-recently-edited first, matching the Notes default
 * "Date Edited" sort. Source: Apple Support, "Sort notes in Notes on Mac".
 */
function readNotes(storage: StorageAdapter): Note[] {
  const raw = storage.get<Note[]>(STORAGE_KEY);
  return Array.isArray(raw) ? raw : [];
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Notes sorted newest-edited first, matching the Apple "Date Edited" default. */
export function listNotes(storage: StorageAdapter): Note[] {
  return readNotes(storage)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createNote(storage: StorageAdapter, body = ""): Note {
  const now = Date.now();
  const next: Note = { id: newId(), body, createdAt: now, updatedAt: now };
  storage.set(STORAGE_KEY, [next, ...readNotes(storage)]);
  return next;
}

export function updateNote(storage: StorageAdapter, id: string, body: string): void {
  storage.set(
    STORAGE_KEY,
    readNotes(storage).map((n) =>
      n.id === id ? { ...n, body, updatedAt: Date.now() } : n,
    ),
  );
}

export function deleteNote(storage: StorageAdapter, id: string): void {
  storage.set(
    STORAGE_KEY,
    readNotes(storage).filter((n) => n.id !== id),
  );
}

/**
 * The note's title is its first non-empty line, trimmed, the way Apple Notes
 * derives it. Returns an empty string for a note that has no text yet so the
 * UI can show its "New Note" placeholder.
 */
export function noteTitle(note: Note): string {
  for (const line of note.body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * Preview text shown under the title in the list: the remaining body after the
 * title line, collapsed to a single line. Apple shows a one-line snippet of the
 * body beneath the title.
 */
export function noteSnippet(note: Note): string {
  const lines = note.body.split("\n");
  let titleSeen = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? "").trim();
    if (!titleSeen) {
      if (trimmed) titleSeen = true;
      continue;
    }
    if (trimmed) {
      return lines.slice(i).join(" ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

export const NOTES_STORAGE_KEY = STORAGE_KEY;
