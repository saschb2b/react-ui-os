"use client";

import { useWindowManager } from "@react-ui-os/core";
import { Window } from "./Window";

/**
 * Compositor: renders one absolutely-positioned <Window> per open WM entry.
 * z-index ordering comes from each window's `z` so click-to-focus naturally
 * lifts the right one to the top.
 *
 * Workspace filtering is a hide, not an unmount: every window stays mounted
 * and windows on other workspaces are flagged `hidden` so <Window> takes them
 * out of the layout with `display: none`. Keeping them mounted preserves each
 * window's React and DOM state (scroll position, form input, app timers) and
 * stops the open animation from replaying every time you switch back, matching
 * how macOS Spaces and GNOME workspaces keep their windows alive.
 */
export function WindowLayer() {
  const { windows, state } = useWindowManager();
  const active = state.activeWorkspaceId;
  return (
    <>
      {windows.map((win) => (
        <Window key={win.id} win={win} hidden={win.workspaceId !== active} />
      ))}
    </>
  );
}
