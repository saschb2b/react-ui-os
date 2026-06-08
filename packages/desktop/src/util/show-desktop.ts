import type { OpenWindow } from "@react-ui-os/core";

/**
 * Plan a Windows "Show desktop" toggle for the active workspace.
 *
 * If any window there is visible, minimize them all and remember the set, so the
 * next toggle can restore exactly those. Otherwise the desktop is already clear,
 * so restore the remembered set, or everything still minimized here when there
 * is no stash (the user minimized by hand). Restore ids are filtered to windows
 * that still exist, so a closed-in-between window is skipped.
 *
 * Pure so the toggle behavior is testable without the component.
 */
export function planShowDesktop(
  windows: OpenWindow[],
  activeWorkspaceId: string,
  stash: readonly string[],
): { minimize: string[]; restore: string[]; nextStash: string[] } {
  const onWorkspace = windows.filter((w) => w.workspaceId === activeWorkspaceId);
  const visible = onWorkspace.filter((w) => w.state !== "minimized");
  if (visible.length > 0) {
    const ids = visible.map((w) => w.id);
    return { minimize: ids, restore: [], nextStash: ids };
  }
  const minimized = onWorkspace.filter((w) => w.state === "minimized");
  const live = new Set(minimized.map((w) => w.id));
  const source = stash.length > 0 ? stash : minimized.map((w) => w.id);
  return { minimize: [], restore: source.filter((id) => live.has(id)), nextStash: [] };
}
