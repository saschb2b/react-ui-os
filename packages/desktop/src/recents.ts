import type { ReactNode } from "react";

// Same bundler-agnostic dev/prod switch use-launcher.ts uses; see the note
// there for why the one global is typed locally.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * One row in the Start menu's "Recent" section. Windows 11's redesigned Start
 * renames "Recommended" to "Recent" and fills it with recently installed apps
 * and recently used files. The apps half comes from the window manager's own
 * recency; these sources contribute the files half: notes, documents,
 * downloads, presets, whatever the consumer's apps touch and persist.
 * Source: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/
 */
export interface RecentItem {
  /** Stable id within the source; the menu keys rows by source id plus this. */
  id: string;
  /** Visible row label, e.g. the document title. */
  name: string;
  /** Epoch ms of last use. The section orders newest first. */
  timestamp: number;
  /** Type label under the name ("Note", "Download"). */
  kindLabel?: string;
  /** Accent color tinting the row's tile gradient. */
  accent?: string;
  /** Optional icon node rendered inside the tile. */
  icon?: ReactNode;
  /** What to do when the row is activated (Enter or click). */
  onActivate: () => void;
}

/**
 * A recents source returns its current items each time the Start menu opens.
 * Read your own store inside the function so the rows are always fresh; the
 * registry never caches results.
 */
export type RecentsSource = () => RecentItem[];

/** A merged item tagged with the id of the source that produced it. */
export type RecentEntry = RecentItem & { sourceId: string };

const sources = new Map<string, RecentsSource>();
const listeners = new Set<() => void>();

/**
 * Register a recents source. Returns an unsubscribe function. Sources are
 * keyed by `id` so registering twice with the same id replaces the previous
 * one, useful when a host component re-mounts.
 */
export function registerRecentsSource(id: string, source: RecentsSource): () => void {
  sources.set(id, source);
  listeners.forEach((l) => {
    l();
  });
  return () => {
    if (sources.get(id) === source) {
      sources.delete(id);
      listeners.forEach((l) => {
        l();
      });
    }
  };
}

/** Number of registered sources; a cheap version token for useSyncExternalStore. */
export function countRecentsSources(): number {
  return sources.size;
}

/**
 * Query every source and merge the results, newest first. A misbehaving
 * source is dropped for that call (with a dev-only warning) rather than
 * tearing down the Start menu, the same guard the launcher applies to
 * Spotlight sources.
 */
export function listRecentItems(): RecentEntry[] {
  const merged: RecentEntry[] = [];
  for (const [sourceId, source] of sources) {
    try {
      for (const item of source()) {
        merged.push({ ...item, sourceId });
      }
    } catch (err) {
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
        console.warn("[react-ui-os] recents source threw:", err);
      }
    }
  }
  return merged.sort((a, b) => b.timestamp - a.timestamp);
}

/** Subscribe to source-registry changes; returns unsubscribe. */
export function subscribeRecentsSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
