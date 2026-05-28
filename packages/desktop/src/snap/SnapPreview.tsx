"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "../desktop-context";
import { getSnapPreview, subscribeSnapPreview } from "./snap-store";

/**
 * Translucent rectangle that appears while a window drag hovers a snap
 * zone. Reads from the snap store — Window updates it during drag, this
 * component just paints. Lives inside the same provider as the windows so
 * the theme accent feels coherent.
 */
export function SnapPreview() {
  const theme = useTheme();
  const state = useSyncExternalStore(
    subscribeSnapPreview,
    getSnapPreview,
    () => null,
  );

  if (!state) return null;

  const { rect } = state;
  const accent = theme.palette.accent;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        background: `${accent}22`,
        border: `2px solid ${accent}aa`,
        borderRadius: theme.shape.windowRadius,
        boxShadow: `inset 0 0 32px ${accent}33, 0 0 24px ${accent}55`,
        pointerEvents: "none",
        zIndex: 90,
        transition: "left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease",
      }}
    />
  );
}
