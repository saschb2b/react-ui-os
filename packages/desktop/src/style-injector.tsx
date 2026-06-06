"use client";

import { useEffect } from "react";

/**
 * Injects the small set of keyframes the desktop relies on. Lives at the
 * Desktop root so consumer apps don't need to import a CSS file. The
 * keyframe names are namespaced with `rui-` so they don't collide with
 * other libraries.
 *
 * The genie animation references CSS custom properties (`--genie-from-x/y`,
 * `--genie-to-x/y`, and `--genie-scale`) that the Window component sets before
 * triggering the minimize. `from` is the window's current top-left; `to` is the
 * translate that lands the window's center on its dock tile, and `--genie-scale`
 * is the tile's footprint relative to the window, so each window shrinks to its
 * own tile's size and flies there instead of a fixed point and scale.
 *
 * Open and close use the individual `scale` property rather than baking a
 * transform into the keyframe. The window already carries its position in an
 * inline `transform`; `scale` composes on top of it and pivots on the window's
 * `transform-origin`, so the window scales about that point wherever it sits.
 * The default origin is center, which matches macOS (Lion onward), where a new
 * window grows from a point centered on its final position; a theme can move it
 * (the Ubuntu theme pivots on the bottom edge, the GNOME map behavior) via
 * `motion.windowOpenOrigin`. The start scale comes from `--rui-open-scale`
 * (default 0.92), set per theme by `motion.windowOpenScale`. (Folding the scale
 * into the keyframe's transform would discard the position and fly the window
 * in from the origin.)
 */
export function StyleInjector() {
  useEffect(() => {
    const id = "rui-desktop-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes rui-window-open {
        from { opacity: 0; scale: var(--rui-open-scale, 0.92); }
        to   { opacity: 1; scale: 1; }
      }
      @keyframes rui-window-close {
        from { opacity: 1; scale: 1; }
        to   { opacity: 0; scale: var(--rui-open-scale, 0.92); }
      }
      @keyframes rui-window-genie {
        from {
          opacity: 1;
          transform: translate3d(var(--genie-from-x, 0px), var(--genie-from-y, 0px), 0) scale(1);
        }
        to {
          opacity: 0;
          transform: translate3d(var(--genie-to-x, 0px), var(--genie-to-y, 0px), 0) scale(var(--genie-scale, 0.08));
        }
      }
      @keyframes rui-wallpaper-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}
