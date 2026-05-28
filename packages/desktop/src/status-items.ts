import type { ReactNode } from "react";

/**
 * Status items are the small widgets that live in the right-hand cluster
 * of the menu bar. Battery indicators, network status, sync state, an
 * online dot, a current-track player — anything that lives outside the
 * app windows and needs a permanent home next to the clock.
 *
 * The contract mirrors `registerSpotlightSource`: register an item from
 * any code, get back an unsubscribe, components subscribe via
 * `useSyncExternalStore`. Items render in declared `order`, low-first.
 */

export interface StatusItem {
  /** Stable id used as the React key and the dedup token. */
  id: string;
  /** Visible icon, ~14 px. Use your icon kit's ReactNode. */
  icon: ReactNode;
  /** Tooltip text shown on hover ("Battery 78%"). */
  tooltip?: string;
  /** Visual badge such as an unread count or status dot. */
  badge?: string | number;
  /** Tooltip-side shortcut hint ("⌃⇧Space"). Decorative. */
  shortcut?: string;
  /** Click handler. If absent, the item renders as a non-interactive marker. */
  onClick?: () => void;
  /** Render order. Lower numbers sit further from the clock. Defaults to 100. */
  order?: number;
}

const items = new Map<string, StatusItem>();
const listeners = new Set<() => void>();
// Cached snapshot. `listStatusItems` is used as the getSnapshot for
// useSyncExternalStore, so it MUST return the same array reference
// between mutations — otherwise React detects an "always-different"
// snapshot and bails with "result of getServerSnapshot should be
// cached", which manifests as an infinite render loop.
let cachedSnapshot: StatusItem[] = [];

function rebuildSnapshot(): void {
  cachedSnapshot = Array.from(items.values()).sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100),
  );
}

function emit(): void {
  rebuildSnapshot();
  for (const listener of listeners) listener();
}

/**
 * Register a status item. Returns an unsubscribe. Re-registering the same
 * id replaces the previous record so a host component can re-render with
 * an updated badge without churn.
 */
export function registerStatusItem(item: StatusItem): () => void {
  items.set(item.id, item);
  emit();
  return () => {
    if (items.get(item.id) === item) {
      items.delete(item.id);
      emit();
    }
  };
}

/** Remove an item by id. Useful when the registration was made imperatively. */
export function unregisterStatusItem(id: string): void {
  if (!items.has(id)) return;
  items.delete(id);
  emit();
}

/**
 * Read the cached snapshot. Stable across calls until a registration
 * mutates the registry, at which point a single new array is built and
 * cached for subsequent reads.
 */
export function listStatusItems(): StatusItem[] {
  return cachedSnapshot;
}

export function subscribeStatusItems(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
