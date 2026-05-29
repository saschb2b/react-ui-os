"use client";

import { useSyncExternalStore } from "react";

/**
 * The desktop has two layouts:
 *
 *   regular  Standard sizes: 56 px dock tiles, 24 px menu bar, 32 px
 *            window title bars. The default at any desktop-class viewport.
 *   compact  Tighter chrome: 40 px dock tiles, 22 px menu bar, 28 px
 *            title bars. Triggered when the desktop is rendered into a
 *            tiny viewport (a docs iframe, a phone, etc.) where the
 *            full-size chrome would consume too much of the work area.
 *
 * The threshold is intentionally generous: 800 × 540. Below that, the
 * 56 px dock alone takes ~20 % of the vertical space.
 */
export type ViewportMode = "regular" | "compact";

const COMPACT_WIDTH = 800;
const COMPACT_HEIGHT = 540;

/**
 * Read the mode synchronously from the current viewport. Safe to call
 * from non-React code (e.g. work-area math). SSR-safe: returns
 * `"regular"` when there is no `window`.
 */
export function getViewportMode(): ViewportMode {
  if (typeof window === "undefined") return "regular";
  if (window.innerWidth < COMPACT_WIDTH) return "compact";
  if (window.innerHeight < COMPACT_HEIGHT) return "compact";
  return "regular";
}

// Vanilla pub/sub so React components and module-level helpers share
// the same source of truth without each component having to register
// its own resize listener.
const listeners = new Set<() => void>();
let resizeBound = false;
let cachedMode: ViewportMode = "regular";

function ensureResizeListener(): void {
  if (resizeBound || typeof window === "undefined") return;
  resizeBound = true;
  cachedMode = getViewportMode();
  window.addEventListener("resize", () => {
    const next = getViewportMode();
    if (next === cachedMode) return;
    cachedMode = next;
    for (const listener of listeners) listener();
  });
}

function subscribe(listener: () => void): () => void {
  ensureResizeListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ViewportMode {
  ensureResizeListener();
  return cachedMode;
}

function getServerSnapshot(): ViewportMode {
  return "regular";
}

/**
 * React-side accessor. Re-renders the component when the desktop crosses
 * the compact / regular threshold.
 */
export function useViewportMode(): ViewportMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
