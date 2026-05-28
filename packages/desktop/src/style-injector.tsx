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
 */
export function StyleInjector() {
  useEffect(() => {
    const id = "rui-desktop-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes rui-window-open {
        from { opacity: 0; transform: translate3d(var(--rui-open-x, 0), calc(var(--rui-open-y, 0) + 6px), 0) scale(0.985); }
        to   { opacity: 1; }
      }
      @keyframes rui-window-close {
        from { opacity: 1; }
        to   { opacity: 0; transform: translate3d(var(--rui-open-x, 0), calc(var(--rui-open-y, 0) + 6px), 0) scale(0.985); }
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
