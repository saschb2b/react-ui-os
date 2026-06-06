"use client";

import { useEffect } from "react";
import { useWindowManager, windowIdOf } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { MISSION_CONTROL_TOGGLE_EVENT, SPOTLIGHT_OPEN_EVENT } from "./events";
import { rectForZone, recordSnapRestore, type SnapZone } from "./snap";
import { showHud } from "./hud";
import { nextCascadeIndex, pickInitialBounds } from "./util/initial-bounds";
import { getWorkArea } from "./util/layout";

/**
 * Global keyboard shortcut handler. Renders null. Mount once anywhere
 * inside `<DesktopProvider>` (the default `<Desktop>` mounts it for you).
 *
 *   Cmd/Ctrl+W            close focused window
 *   Cmd/Ctrl+M            minimize focused window
 *   Cmd/Ctrl+1..9         open / focus / cycle-minimize app N (1-indexed into
 *                         the apps registry, in declared order)
 *   Cmd/Ctrl+K            dispatches SPOTLIGHT_OPEN_EVENT
 *   Cmd/Ctrl+,            open Settings (macOS convention)
 *   Super/Win/Cmd+Arrow   snap the focused window (Up maximize, Down restore,
 *                         Left/Right halves, +Shift quarters), the Windows
 *                         Win+Arrow / GNOME Super+Arrow chords
 *   Ctrl+Alt+Arrow        switch workspace (+Shift brings the focused window)
 *   Escape                restore the focused window if maximized
 *
 * Every binding bails when the event target is an `<input>`, `<textarea>`, or
 * contenteditable element, so typing in fields is never hijacked. The full
 * shortcut registry, including Mission Control and the app switcher, and the
 * test that proves no two chords clash, live in keymap.ts.
 */
export function KeyboardShortcuts() {
  const apps = useApps();
  const theme = useTheme();
  const {
    focusedWindow,
    windowById,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    focusWindow,
    setBounds,
    toggleMaximize,
    state,
    switchWorkspace,
    moveWindowToWorkspace,
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

      // Cmd-, opens Settings as a system window (macOS convention).
      if (mod && e.key === ",") {
        e.preventDefault();
        const payload = { kind: "system" as const, systemId: "settings" };
        openWindow(
          payload,
          pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
        );
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
          const payload = { kind: "app" as const, appId: app.id };
          openWindow(
            payload,
            pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
          );
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

      // Ctrl + Alt + ←/→ switches workspaces.
      // Ctrl + Alt + Shift + ←/→ moves the focused window with you.
      if (e.ctrlKey && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const idx = state.workspaces.indexOf(state.activeWorkspaceId);
        if (idx < 0) return;
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const nextIdx = (idx + dir + state.workspaces.length) % state.workspaces.length;
        const nextId = state.workspaces[nextIdx];
        if (!nextId || nextId === state.activeWorkspaceId) return;
        if (e.shiftKey && focusedWindow) {
          moveWindowToWorkspace(focusedWindow.id, nextId);
        }
        switchWorkspace(nextId);
        showHud({
          title: `Workspace ${String(nextIdx + 1)}`,
          sublabel: e.shiftKey ? "Window moved with you" : undefined,
        });
        return;
      }

      // Mission Control (F3, or Ctrl+Up, the macOS convention). The overview
      // owns its open/close state, so dispatch the toggle rather than reach in;
      // routing it through this single dispatcher keeps Ctrl+Up to one owner.
      if (
        e.key === "F3" ||
        (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "ArrowUp")
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(MISSION_CONTROL_TOGGLE_EVENT));
        return;
      }

      // Super/Win/Cmd (metaKey) + Arrow snaps the focused window to a zone,
      // matching the Windows Win+Arrow and GNOME Super+Arrow snap chords. It is
      // deliberately not the Cmd-or-Ctrl modifier the shortcuts above use:
      // Ctrl+Arrow belongs to macOS (spaces, and Ctrl+Up is Mission Control),
      // so binding snap to metaKey alone keeps the keymap clash-free. The full
      // registry and its conflict test live in keymap.ts.
      // Up = maximize, Down = restore, Left/Right = halves, Shift = quarters.
      if (e.metaKey && focusedWindow && focusedWindow.state !== "maximized") {
        const zone = arrowToZone(e.key, e.shiftKey);
        if (zone) {
          e.preventDefault();
          // Same as a drag-snap: remember the pre-snap size so dragging the
          // window off the zone later restores it.
          recordSnapRestore(focusedWindow.id, {
            w: focusedWindow.w,
            h: focusedWindow.h,
          });
          const rect = rectForZone(zone, getWorkArea(theme));
          setBounds(focusedWindow.id, rect.x, rect.y, rect.w, rect.h);
          showHud({ title: snapZoneLabel(zone) });
          return;
        }
      }
      // Super/Win/Cmd + Up maximizes; while maximized it's a no-op (Ctrl+Up is
      // Mission Control, handled elsewhere). Super/Win/Cmd + Down restores.
      if (e.metaKey && focusedWindow && e.key === "ArrowUp") {
        if (focusedWindow.state !== "maximized") {
          e.preventDefault();
          toggleMaximize(focusedWindow.id);
          showHud({ title: "Maximized" });
        }
        return;
      }
      if (e.metaKey && focusedWindow && e.key === "ArrowDown") {
        if (focusedWindow.state === "maximized") {
          e.preventDefault();
          toggleMaximize(focusedWindow.id);
          showHud({ title: "Restored" });
        }
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
    setBounds,
    theme,
    toggleMaximize,
    state,
    switchWorkspace,
    moveWindowToWorkspace,
  ]);

  return null;
}

function snapZoneLabel(zone: SnapZone): string {
  switch (zone) {
    case "left-half":
      return "Snapped Left";
    case "right-half":
      return "Snapped Right";
    case "top-max":
      return "Maximized";
    case "top-left-quarter":
      return "Top Left Quarter";
    case "top-right-quarter":
      return "Top Right Quarter";
    case "bottom-left-quarter":
      return "Bottom Left Quarter";
    case "bottom-right-quarter":
      return "Bottom Right Quarter";
  }
}

function arrowToZone(key: string, shift: boolean): SnapZone | null {
  // Cmd/Ctrl + Shift + Arrow picks a quarter zone in the indicated corner.
  if (shift) {
    if (key === "ArrowLeft") return "top-left-quarter";
    if (key === "ArrowRight") return "top-right-quarter";
    // Down + Shift = bottom corners. Direction comes from the next key.
    return null;
  }
  if (key === "ArrowLeft") return "left-half";
  if (key === "ArrowRight") return "right-half";
  return null;
}
