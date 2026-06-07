"use client";

import { useEffect } from "react";
import { useWindowManager, windowIdOf } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import {
  APP_SWITCHER_CYCLE_EVENT,
  KEYBOARD_HELP_TOGGLE_EVENT,
  MISSION_CONTROL_TOGGLE_EVENT,
  SPOTLIGHT_OPEN_EVENT,
} from "./events";
import { chordMatches } from "./keymap";
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
 *   Mod+Arrow             snap the focused window (Up maximize, Down restore,
 *                         Left/Right halves, +Shift quarters). The references
 *                         snap with Win/Super, but the OS eats that key before
 *                         the page, so this uses Mod (Ctrl, or Cmd on macOS)
 *   Ctrl+Alt+Arrow        switch workspace (+Shift brings the focused window)
 *   F3                    Mission Control (Ctrl+Up is the macOS overview key,
 *                         claimed by the OS, so it stays free for maximize)
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

      // Each branch gates on chordMatches(e, id) so the chords come from the
      // keymap registry rather than being hardcoded here, and the conflict test
      // therefore guards the combos this dispatcher actually uses.

      // Spotlight (Mod+K), via the shared event.
      if (chordMatches(e, "app.spotlight")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT));
        return;
      }

      // Keyboard shortcuts help (Mod+/), the GNOME Ctrl+? convention.
      if (chordMatches(e, "app.help")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(KEYBOARD_HELP_TOGGLE_EVENT));
        return;
      }

      // App switcher (Mod+Tab, Mod+Shift+Tab to reverse). The hold-and-release
      // machine lives in AppSwitcher; the dispatcher owns the keydown chord and
      // tells it to advance, so the switcher needs no second global keydown.
      if (chordMatches(e, "app.switcher")) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent(APP_SWITCHER_CYCLE_EVENT, {
            detail: { backward: e.shiftKey },
          }),
        );
        return;
      }

      // Settings (Mod+,) as a system window, the macOS convention.
      if (chordMatches(e, "app.settings")) {
        e.preventDefault();
        const payload = { kind: "system" as const, systemId: "settings" };
        openWindow(
          payload,
          pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
        );
        return;
      }

      // Close the focused window (Mod+W).
      if (chordMatches(e, "window.close")) {
        if (focusedWindow) {
          e.preventDefault();
          closeWindow(focusedWindow.id);
        }
        return;
      }

      // Minimize the focused window (Mod+M).
      if (chordMatches(e, "window.minimize")) {
        if (focusedWindow) {
          e.preventDefault();
          minimizeWindow(focusedWindow.id);
        }
        return;
      }

      // Mod+1..9 cycles app N by registry index: open, then focus, then
      // minimize if already focused, restore if minimized.
      if (chordMatches(e, "app.byIndex")) {
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

      // Restore a maximized window (Mod+Down or Escape).
      if (chordMatches(e, "window.unmaximize")) {
        if (focusedWindow?.state === "maximized") {
          e.preventDefault();
          toggleMaximize(focusedWindow.id);
          showHud({ title: "Restored" });
        }
        return;
      }

      // Ctrl+Alt+Arrow switches workspace; +Shift brings the focused window.
      if (
        chordMatches(e, "space.prev") ||
        chordMatches(e, "space.next") ||
        chordMatches(e, "space.movePrev") ||
        chordMatches(e, "space.moveNext")
      ) {
        e.preventDefault();
        const idx = state.workspaces.indexOf(state.activeWorkspaceId);
        if (idx < 0) return;
        const forward =
          chordMatches(e, "space.next") || chordMatches(e, "space.moveNext");
        const withWindow =
          chordMatches(e, "space.movePrev") || chordMatches(e, "space.moveNext");
        const dir = forward ? 1 : -1;
        const nextIdx = (idx + dir + state.workspaces.length) % state.workspaces.length;
        const nextId = state.workspaces[nextIdx];
        if (!nextId || nextId === state.activeWorkspaceId) return;
        if (withWindow && focusedWindow) {
          moveWindowToWorkspace(focusedWindow.id, nextId);
        }
        switchWorkspace(nextId);
        showHud({
          title: `Workspace ${String(nextIdx + 1)}`,
          sublabel: withWindow ? "Window moved with you" : undefined,
        });
        return;
      }

      // Mission Control (F3). Its overview chords (Ctrl+Up on macOS, the Win/
      // Super overview keys) are claimed by the host OS, so F3 is the reachable
      // one. The overview owns its open state, so dispatch its toggle event.
      if (chordMatches(e, "space.missionControl")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(MISSION_CONTROL_TOGGLE_EVENT));
        return;
      }

      // Mod+Arrow snaps the focused window to a zone. The references snap with
      // the Win/Super key, but the OS eats that before the page (Win+Arrow
      // maximizes the browser, not us), so we use Mod (Ctrl, or Cmd on macOS).
      // Like a drag-snap it records the pre-snap size, so a later drag off the
      // zone restores it.
      const zone = snapZoneFor(e);
      if (zone && focusedWindow && focusedWindow.state !== "maximized") {
        e.preventDefault();
        recordSnapRestore(focusedWindow.id, {
          w: focusedWindow.w,
          h: focusedWindow.h,
        });
        const rect = rectForZone(zone, getWorkArea(theme));
        setBounds(focusedWindow.id, rect.x, rect.y, rect.w, rect.h);
        showHud({ title: snapZoneLabel(zone) });
        return;
      }

      // Mod+Up maximizes (a no-op while already maximized).
      if (chordMatches(e, "window.maximize")) {
        if (focusedWindow && focusedWindow.state !== "maximized") {
          e.preventDefault();
          toggleMaximize(focusedWindow.id);
          showHud({ title: "Maximized" });
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

// Which snap zone the event's chord asks for, read from the registry's snap
// shortcuts (Mod+Left/Right halves, Mod+Shift+Left/Right top quarters).
function snapZoneFor(e: KeyboardEvent): SnapZone | null {
  if (chordMatches(e, "window.snapLeft")) return "left-half";
  if (chordMatches(e, "window.snapRight")) return "right-half";
  if (chordMatches(e, "window.snapTopLeft")) return "top-left-quarter";
  if (chordMatches(e, "window.snapTopRight")) return "top-right-quarter";
  return null;
}
