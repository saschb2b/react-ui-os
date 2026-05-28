"use client";

import { useEffect } from "react";
import { useWindowManager, windowIdOf } from "@react-ui-os/core";
import { useApps } from "./desktop-context";
import { SPOTLIGHT_OPEN_EVENT } from "./events";

/**
 * Global keyboard shortcut handler. Renders null. Mount once anywhere
 * inside `<DesktopProvider>` (the default `<Desktop>` mounts it for you).
 *
 *   Cmd/Ctrl+W       close focused window
 *   Cmd/Ctrl+M       minimize focused window
 *   Cmd/Ctrl+1..9    open / focus / cycle-minimize app N (1-indexed into
 *                    the apps registry, in declared order)
 *   Cmd/Ctrl+K       dispatches SPOTLIGHT_OPEN_EVENT
 *   Escape           restores the focused window if maximized
 *
 * Every binding bails when the event target is an `<input>`,
 * `<textarea>`, or contenteditable element, so typing in fields is never
 * hijacked. Spotlight handles its own Cmd-K toggle and its own Escape, so
 * those don't conflict.
 */
export function KeyboardShortcuts() {
  const apps = useApps();
  const {
    focusedWindow,
    windowById,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    focusWindow,
    toggleMaximize,
  } = useWindowManager();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd-K opens Spotlight via the shared event.
      if (mod && key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT));
        return;
      }

      // Cmd-W closes the focused window.
      if (mod && key === "w") {
        if (focusedWindow) {
          e.preventDefault();
          closeWindow(focusedWindow.id);
        }
        return;
      }

      // Cmd-M minimizes the focused window.
      if (mod && key === "m") {
        if (focusedWindow) {
          e.preventDefault();
          minimizeWindow(focusedWindow.id);
        }
        return;
      }

      // Cmd-1..9 cycles through apps by registry index.
      // First press opens; if already focused and visible, minimize;
      // if open but unfocused or minimized, focus / restore.
      if (mod && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const app = apps[idx];
        if (!app) return;
        e.preventDefault();
        const id = windowIdOf({ kind: "app", appId: app.id });
        const win = windowById(id);
        if (!win) {
          openWindow({ kind: "app", appId: app.id });
          return;
        }
        if (win.state === "minimized") {
          restoreWindow(id);
          return;
        }
        if (focusedWindow?.id === id) {
          minimizeWindow(id);
          return;
        }
        focusWindow(id);
        return;
      }

      // Escape restores a maximized focused window.
      if (e.key === "Escape" && focusedWindow?.state === "maximized") {
        e.preventDefault();
        toggleMaximize(focusedWindow.id);
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [
    apps,
    focusedWindow,
    windowById,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    focusWindow,
    toggleMaximize,
  ]);

  return null;
}
