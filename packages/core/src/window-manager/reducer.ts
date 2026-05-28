import type {
  OpenWindow,
  WindowBounds,
  WindowManagerAction,
  WindowManagerState,
} from "./types";
import { windowIdOf } from "./types";

export const initialWindowManagerState: WindowManagerState = {
  windows: [],
  focusedId: null,
  nextZ: 1,
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
        // Opening an app that's already open focuses + un-minimizes it; the
        // payload is refreshed too so "system" windows with shared ids can
        // navigate (Downloads <-> Presets style).
        return focusWindow(state, id, {
          payload: action.payload,
          state: "normal",
        });
      }
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
      };
      return bumpZ({
        windows: [...state.windows, win],
        focusedId: id,
        nextZ: z + 1,
      });
    }
    case "CLOSE": {
      const windows = state.windows.filter((w) => w.id !== action.id);
      const focusedId =
        state.focusedId === action.id ? topVisibleId(windows) : state.focusedId;
      return { ...state, windows, focusedId };
    }
    case "FOCUS":
      return focusWindow(state, action.id);
    case "MINIMIZE": {
      const windows = state.windows.map((w) =>
        w.id === action.id ? { ...w, state: "minimized" as const } : w,
      );
      const focusedId =
        state.focusedId === action.id ? topVisibleId(windows) : state.focusedId;
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
            ? { ...w, x: action.x, y: action.y, w: action.w, h: action.h }
            : w,
        ),
      };
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
  return bumpZ({
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
 * a threshold. Order is preserved.
 */
function bumpZ(state: WindowManagerState): WindowManagerState {
  if (state.nextZ < Z_RENORMALIZE_AT) return state;
  const ordered = [...state.windows].sort((a, b) => a.z - b.z);
  const remapped = new Map<string, number>();
  ordered.forEach((w, i) => {
    remapped.set(w.id, i + 1);
  });
  return {
    windows: state.windows.map((w) => ({
      ...w,
      z: remapped.get(w.id) ?? w.z,
    })),
    focusedId: state.focusedId,
    nextZ: ordered.length + 1,
  };
}

function topVisibleId(windows: OpenWindow[]): string | null {
  let top: OpenWindow | null = null;
  for (const w of windows) {
    if (w.state === "minimized") continue;
    if (top === null || w.z > top.z) top = w;
  }
  return top?.id ?? null;
}
