"use client";

import { useEffect } from "react";
import { useWindowManager, windowIdOf } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { SPOTLIGHT_OPEN_EVENT } from "./events";
import { rectForZone, type SnapZone } from "./snap";
import { showHud } from "./hud";
import { pickInitialBounds } from "./util/initial-bounds";
import { getWorkArea } from "./util/layout";

/**
 * Global keyboard shortcut handler. Renders null. Mount once anywhere
 * inside `<DesktopProvider>` (the default `<Desktop>` mounts it for you).
 *
 *   Cmd/Ctrl+W       close focused window
 *   Cmd/Ctrl+M       minimize focused window
 *   Cmd/Ctrl+1..9    open / focus / cycle-minimize app N (1-indexed into
 *                    the apps registry, in declared order)
 *   Cmd/Ctrl+K       dispatches SPOTLIGHT_OPEN_EVENT
 *   Cmd/Ctrl+,       open Settings (macOS convention)
 *   Escape           restores the focused window if maximized
 *
 * Every binding bails when the event target is an `<input>`,
 * `<textarea>`, or contenteditable element, so typing in fields is never
 * hijacked. Spotlight handles its own Cmd-K toggle and its own Escape, so
 * those don't conflict.
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
        openWindow(payload, pickInitialBounds(payload, theme, apps));
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
          openWindow(payload, pickInitialBounds(payload, theme, apps));
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

      // Cmd/Ctrl + Arrow snaps the focused window to a viewport zone.
      // Mirrors the Windows Snap chord (Win + Arrow) on a Mac-friendly
      // modifier. Up = maximize, Down = restore (or center if not snapped),
      // Left/Right = halves.
      if (mod && focusedWindow && focusedWindow.state !== "maximized") {
        const zone = arrowToZone(e.key, e.shiftKey);
        if (zone) {
          e.preventDefault();
          const rect = rectForZone(zone, getWorkArea(theme));
          setBounds(focusedWindow.id, rect.x, rect.y, rect.w, rect.h);
          showHud({ title: snapZoneLabel(zone) });
          return;
        }
      }
      // Cmd/Ctrl + Up while maximized is a no-op; while not, it toggles
      // maximize. Cmd/Ctrl + Down restores from maximize.
      if (mod && focusedWindow && e.key === "ArrowUp") {
        if (focusedWindow.state !== "maximized") {
          e.preventDefault();
          toggleMaximize(focusedWindow.id);
          showHud({ title: "Maximized" });
        }
        return;
      }
      if (mod && focusedWindow && e.key === "ArrowDown") {
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
