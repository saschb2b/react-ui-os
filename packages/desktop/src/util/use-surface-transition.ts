"use client";

import { type CSSProperties, useEffect, useState } from "react";

export type SurfacePhase = "opening" | "open" | "closing";

export interface SurfaceTransitionOptions {
  /**
   * Open / close duration. Pass it already reduced-motion-aware (0 when the
   * user prefers reduced motion), the way `<Window>` does, so the surface
   * collapses to an instant cut rather than animating.
   */
  durationMs: number;
  /** Easing for the open / close keyframe, typically `motion.windowOpenEasing`. */
  easing: string;
}

export interface SurfaceTransition {
  /** Render while true; stays true through the close animation, then unmounts. */
  mounted: boolean;
  phase: SurfacePhase;
  /** Spread onto the surface panel: the same scale-and-fade a window opens with. */
  surfaceStyle: CSSProperties;
  /** Spread onto the dimmed backdrop, if the surface has one: a plain fade. */
  backdropStyle: CSSProperties;
}

/**
 * Open / close transition for a surface mounted on demand (a dialog, popover,
 * or overlay), so it grows in and shrinks out with the same motion the window
 * manager gives real windows instead of popping. It keeps the element mounted
 * through the close animation, then unmounts.
 *
 * The animation is the shared `rui-window-open` / `rui-window-close` keyframe
 * (the scale-from-`--rui-open-scale`-and-fade that `<Window>` uses), so every
 * surface that adopts this hook inherits one consistent motion. Pass the
 * surface's `open` flag and a duration read reduced-motion-aware from the
 * theme; render while `mounted`, spread `surfaceStyle` on the panel and
 * `backdropStyle` on the dim layer.
 */
export function useSurfaceTransition(
  open: boolean,
  { durationMs, easing }: SurfaceTransitionOptions,
): SurfaceTransition {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<SurfacePhase>(open ? "open" : "closing");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase("opening");
      // A small buffer past the animation before dropping to idle, so the
      // keyframe is fully done before its `animation` is pulled.
      const id = window.setTimeout(() => {
        setPhase("open");
      }, durationMs + 40);
      return () => {
        window.clearTimeout(id);
      };
    }
    setPhase("closing");
    const id = window.setTimeout(() => {
      setMounted(false);
    }, durationMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [open, durationMs]);

  const surfaceStyle: CSSProperties =
    phase === "opening"
      ? { animation: `rui-window-open ${String(durationMs)}ms ${easing} both` }
      : phase === "closing"
        ? { animation: `rui-window-close ${String(durationMs)}ms ${easing} both` }
        : {};

  const backdropStyle: CSSProperties =
    phase === "opening"
      ? { animation: `rui-fade-in ${String(durationMs)}ms ${easing} both` }
      : phase === "closing"
        ? { animation: `rui-fade-out ${String(durationMs)}ms ${easing} both` }
        : {};

  return { mounted, phase, surfaceStyle, backdropStyle };
}
