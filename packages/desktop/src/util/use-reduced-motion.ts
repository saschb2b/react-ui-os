"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function supported(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(onChange: () => void): () => void {
  if (!supported()) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return supported() ? window.matchMedia(QUERY).matches : false;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Tracks the user's `prefers-reduced-motion` setting, reactively. Built on
 * `useSyncExternalStore` so it is correct on the first client render (no
 * one-frame flash of motion) and safe under SSR, where it reports `false`.
 * Used to collapse non-essential motion (the wallpaper dissolve, the window
 * open / close / genie animations, the Mission Control spread) to instant, the
 * platform convention for motion-sensitive users.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
