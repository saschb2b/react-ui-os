import type {
  OpenWindow,
  WindowBounds,
  WindowManagerAction,
  WindowManagerState,
} from "./types";
import { windowIdOf } from "./types";

export const DEFAULT_WORKSPACES = ["1", "2", "3"];

export const initialWindowManagerState: WindowManagerState = {
  windows: [],
  focusedId: null,
  nextZ: 1,
  workspaces: [...DEFAULT_WORKSPACES],
  activeWorkspaceId: DEFAULT_WORKSPACES[0] ?? "1",
};

const DEFAULT_BOUNDS: WindowBounds = { x: 80, y: 80, w: 720, h: 480 };
/** Renormalize z-indices once they grow past this to keep numbers bounded. */
const Z_RENORMALIZE_AT = 10_000;

export function windowManagerReducer(
  state: WindowManagerState,
  action: WindowManagerAction,
): WindowManagerState {
  switch (action.type) {
    case "OPEN": {
      const id = windowIdOf(action.payload);
      const existing = state.windows.find((w) => w.id === id);
      if (existing) {
        // Opening an app that's already open focuses + un-minimizes it. If
        // it lives on another workspace, also switch to that workspace —
        // matching the macOS "Cmd+Tab finds you" behavior. The payload is
        // refreshed too so "system" windows with shared ids can navigate.
        const next = state.activeWorkspaceId !== existing.workspaceId
          ? { ...state, activeWorkspaceId: existing.workspaceId }
          : state;
        return focusWindow(next, id, {
          payload: action.payload,
          state: "normal",
        });
      }
      // When no bounds are passed, store the placeholder DEFAULT_BOUNDS and
      // flag the window so the desktop layer (which knows the viewport) can
      // place it on first mount. See OpenWindow.autoBounds.
      const hasExplicitBounds = action.initialBounds != null;
      const bounds = action.initialBounds ?? DEFAULT_BOUNDS;
      const z = state.nextZ;
      const win: OpenWindow = {
        id,
        payload: action.payload,
        state: "normal",
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
        z,
        workspaceId: state.activeWorkspaceId,
        autoBounds: !hasExplicitBounds,
      };
      return bumpZ({
        ...state,
        windows: [...state.windows, win],
        focusedId: id,
        nextZ: z + 1,
      });
    }
    case "CLOSE": {
      const windows = state.windows.filter((w) => w.id !== action.id);
      const focusedId =
        state.focusedId === action.id
          ? topVisibleId(windows, state.activeWorkspaceId)
          : state.focusedId;
      return { ...state, windows, focusedId };
    }
    case "FOCUS":
      return focusWindow(state, action.id);
    case "MINIMIZE": {
      const windows = state.windows.map((w) =>
        w.id === action.id ? { ...w, state: "minimized" as const } : w,
      );
      const focusedId =
        state.focusedId === action.id
          ? topVisibleId(windows, state.activeWorkspaceId)
          : state.focusedId;
      return { ...state, windows, focusedId };
    }
    case "RESTORE":
      return focusWindow(
        {
          ...state,
          windows: state.windows.map((w) =>
            w.id === action.id ? { ...w, state: "normal" as const } : w,
          ),
        },
        action.id,
      );
    case "MAXIMIZE_TOGGLE":
      return focusWindow(
        {
          ...state,
          windows: state.windows.map((w) =>
            w.id === action.id
              ? {
                  ...w,
                  state: w.state === "maximized" ? "normal" : "maximized",
                }
              : w,
          ),
        },
        action.id,
      );
    case "MOVE":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, x: action.x, y: action.y } : w,
        ),
      };
    case "RESIZE":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, w: action.w, h: action.h } : w,
        ),
      };
    case "SET_BOUNDS":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                x: action.x,
                y: action.y,
                w: action.w,
                h: action.h,
                // The window now has real, placed bounds — drop the auto flag
                // so a later remount (e.g. workspace switch) won't re-place it
                // and undo a user's drag.
                autoBounds: false,
              }
            : w,
        ),
      };
    case "SWITCH_WORKSPACE": {
      if (!state.workspaces.includes(action.workspaceId)) return state;
      if (state.activeWorkspaceId === action.workspaceId) return state;
      // When the destination workspace has its own focused window, restore
      // that focus; otherwise drop focus (no windows to take it).
      const candidates = state.windows.filter(
        (w) => w.workspaceId === action.workspaceId && w.state !== "minimized",
      );
      let focusedId: string | null = null;
      for (const w of candidates) {
        if (focusedId === null) {
          focusedId = w.id;
        } else {
          const current = candidates.find((c) => c.id === focusedId);
          if (current && w.z > current.z) focusedId = w.id;
        }
      }
      return {
        ...state,
        activeWorkspaceId: action.workspaceId,
        focusedId,
      };
    }
    case "MOVE_WINDOW_TO_WORKSPACE": {
      if (!state.workspaces.includes(action.workspaceId)) return state;
      const target = state.windows.find((w) => w.id === action.id);
      if (!target || target.workspaceId === action.workspaceId) return state;
      const windows = state.windows.map((w) =>
        w.id === action.id ? { ...w, workspaceId: action.workspaceId } : w,
      );
      // If the moved window had focus on the active workspace, hand focus
      // to whatever now sits on top there.
      const focusedId =
        state.focusedId === action.id
          ? topVisibleId(windows, state.activeWorkspaceId)
          : state.focusedId;
      return { ...state, windows, focusedId };
    }
    case "ADD_WORKSPACE": {
      if (state.workspaces.includes(action.workspaceId)) return state;
      return {
        ...state,
        workspaces: [...state.workspaces, action.workspaceId],
      };
    }
    case "REMOVE_WORKSPACE": {
      if (!state.workspaces.includes(action.workspaceId)) return state;
      if (state.workspaces.length <= 1) return state;
      const remaining = state.workspaces.filter(
        (w) => w !== action.workspaceId,
      );
      // Migrate every window from the removed workspace to the first
      // remaining one. Less surprising than silently dropping windows.
      const fallback = remaining[0] ?? state.activeWorkspaceId;
      const windows = state.windows.map((w) =>
        w.workspaceId === action.workspaceId
          ? { ...w, workspaceId: fallback }
          : w,
      );
      const activeWorkspaceId =
        state.activeWorkspaceId === action.workspaceId
          ? fallback
          : state.activeWorkspaceId;
      const focusedId =
        state.activeWorkspaceId === action.workspaceId
          ? topVisibleId(windows, fallback)
          : state.focusedId;
      return {
        ...state,
        windows,
        workspaces: remaining,
        activeWorkspaceId,
        focusedId,
      };
    }
  }
}

function focusWindow(
  state: WindowManagerState,
  id: string,
  patch?: Partial<Pick<OpenWindow, "payload" | "state">>,
): WindowManagerState {
  const target = state.windows.find((w) => w.id === id);
  if (!target) return state;
  const z = state.nextZ;
  // Focusing a window from a different workspace pulls the user there.
  // Mirrors the macOS "click an app in the dock that lives on another
  // space" jump behavior. Without this, dock clicks would silently fail
  // when the target wasn't on the active workspace.
  const activeWorkspaceId =
    target.workspaceId !== state.activeWorkspaceId
      ? target.workspaceId
      : state.activeWorkspaceId;
  return bumpZ({
    ...state,
    activeWorkspaceId,
    windows: state.windows.map((w) =>
      w.id === id ? { ...w, ...(patch ?? {}), z } : w,
    ),
    focusedId: id,
    nextZ: z + 1,
  });
}

/**
 * Keep z-indices bounded. After enough opens / focuses the counter would grow
 * without limit; this collapses it back into a dense range whenever it crosses
 * a threshold. Order is preserved across all workspaces.
 */
function bumpZ(state: WindowManagerState): WindowManagerState {
  if (state.nextZ < Z_RENORMALIZE_AT) return state;
  const ordered = [...state.windows].sort((a, b) => a.z - b.z);
  const remapped = new Map<string, number>();
  ordered.forEach((w, i) => {
    remapped.set(w.id, i + 1);
  });
  return {
    ...state,
    windows: state.windows.map((w) => ({
      ...w,
      z: remapped.get(w.id) ?? w.z,
    })),
    nextZ: ordered.length + 1,
  };
}

function topVisibleId(
  windows: OpenWindow[],
  workspaceId: string,
): string | null {
  let top: OpenWindow | null = null;
  for (const w of windows) {
    if (w.workspaceId !== workspaceId) continue;
    if (w.state === "minimized") continue;
    if (top === null || w.z > top.z) top = w;
  }
  return top?.id ?? null;
}
