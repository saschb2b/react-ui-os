"use client";

import { useWindowManager } from "@react-ui-os/core";
import { Window } from "./Window";

/**
 * Compositor: renders one absolutely-positioned <Window> per open WM entry.
 * z-index ordering comes from each window's `z` so click-to-focus naturally
 * lifts the right one to the top.
 *
 * Workspace filtering happens here: windows whose `workspaceId` doesn't
 * match the active workspace are skipped entirely. They remain in WM
 * state and keep their bounds; switching back reveals them in place.
 */
export function WindowLayer() {
  const { windows, state } = useWindowManager();
  const active = state.activeWorkspaceId;
  return (
    <>
      {windows
        .filter((w) => w.workspaceId === active)
        .map((win) => (
          <Window key={win.id} win={win} />
        ))}
    </>
  );
}
