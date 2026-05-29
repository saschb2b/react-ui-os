import type { ReactNode } from "react";

/**
 * One result row contributed by a Spotlight source. Sources are how features
 * outside the apps registry and the system-window registry surface in the
 * Cmd-K palette: recently opened docs pages, presets, downloads, bookmarks,
 * or anything else the consumer wants to make findable.
 */
export interface SpotlightResult {
  /** Stable id used as the React key and the dedup token. */
  id: string;
  /** Visible row label. */
  name: string;
  /** Optional one-line subtitle on the right. */
  tagline?: string;
  /** Accent color tinting the row's tile gradient. */
  accent?: string;
  /** Optional icon node rendered inside the tile. */
  icon?: ReactNode;
  /** Source-side label such as "Doc · Spotlight", "Preset · Tubes". */
  kindLabel?: string;
  /** What to do when the row is activated (Enter or click). */
  onActivate: () => void;
}

/**
 * A Spotlight source returns the current set of results for a given query.
 * Receives the raw query string (lowercased, trimmed) and returns the rows
 * to merge into the Spotlight panel. Returning an empty array when the
 * query doesn't apply is the convention.
 */
export type SpotlightSource = (query: string) => SpotlightResult[];

const sources = new Map<string, SpotlightSource>();
const listeners = new Set<() => void>();

/**
 * Register a Spotlight source. Returns an unsubscribe function. Sources are
 * keyed by `id` so registering twice with the same id replaces the previous
 * one, useful when a host component re-mounts.
 */
export function registerSpotlightSource(
  id: string,
  source: SpotlightSource,
): () => void {
  sources.set(id, source);
  listeners.forEach((l) => l());
  return () => {
    if (sources.get(id) === source) {
      sources.delete(id);
      listeners.forEach((l) => l());
    }
  };
}

/** Read every registered source. Order follows registration order. */
export function listSpotlightSources(): SpotlightSource[] {
  return Array.from(sources.values());
}

/** Subscribe to source-registry changes; returns unsubscribe. */
export function subscribeSpotlightSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
