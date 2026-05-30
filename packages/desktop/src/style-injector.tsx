"use client";

import { useEffect } from "react";

/**
 * Injects the small set of keyframes the desktop relies on. Lives at the
 * Desktop root so consumer apps don't need to import a CSS file. The
 * keyframe names are namespaced with `rui-` so they don't collide with
 * other libraries.
 *
 * The genie animation references CSS custom properties (`--genie-dx`,
 * `--genie-dy`) that the Window component sets before triggering the
 * minimize, so each window flies toward its own dock tile.
 *
 * Open and close use the individual `scale` property rather than baking a
 * transform into the keyframe. The window already carries its position in an
 * inline `transform`; `scale` composes on top of it and pivots on the default
 * center transform-origin, so the window scales about its own center wherever
 * it sits. That matches macOS (Lion onward), where a new window grows from a
 * point centered on its final position. (Folding the scale into the keyframe's
 * transform would discard the position and fly the window in from the origin.)
 */
export function StyleInjector() {
  useEffect(() => {
    const id = "rui-desktop-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes rui-window-open {
        from { opacity: 0; scale: 0.92; }
        to   { opacity: 1; scale: 1; }
      }
      @keyframes rui-window-close {
        from { opacity: 1; scale: 1; }
        to   { opacity: 0; scale: 0.92; }
      }
      @keyframes rui-window-genie {
        from {
          opacity: 1;
          transform: translate3d(var(--genie-dx, 0), var(--genie-dy, 0), 0) scale(1);
        }
        to {
          opacity: 0;
          transform: translate3d(var(--genie-dx, 0), var(--genie-dy, 0), 0) scale(0.08);
        }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}
