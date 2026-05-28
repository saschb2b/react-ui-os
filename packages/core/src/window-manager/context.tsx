"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  initialWindowManagerState,
  windowManagerReducer,
} from "./reducer";
import type {
  OpenWindow,
  WindowBounds,
  WindowManagerActions,
  WindowManagerDispatch,
  WindowManagerState,
  WindowPayload,
} from "./types";

interface WindowManagerContextValue {
  state: WindowManagerState;
  dispatch: WindowManagerDispatch;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(
  null,
);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    windowManagerReducer,
    initialWindowManagerState,
  );
  const value = useMemo<WindowManagerContextValue>(
    () => ({ state, dispatch }),
    [state],
  );
  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export interface UseWindowManagerResult extends WindowManagerActions {
  state: WindowManagerState;
  windows: OpenWindow[];
  focusedWindow: OpenWindow | null;
  windowById: (id: string) => OpenWindow | undefined;
}

export function useWindowManager(): UseWindowManagerResult {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) {
    throw new Error(
      "useWindowManager must be used within a WindowManagerProvider",
    );
  }
  const { state, dispatch } = ctx;

  const openWindow = useCallback(
    (payload: WindowPayload, initialBounds?: WindowBounds) => {
      dispatch({ type: "OPEN", payload, initialBounds });
    },
    [dispatch],
  );
  const closeWindow = useCallback(
    (id: string) => {
      dispatch({ type: "CLOSE", id });
    },
    [dispatch],
  );
  const focusWindow = useCallback(
    (id: string) => {
      dispatch({ type: "FOCUS", id });
    },
    [dispatch],
  );
  const minimizeWindow = useCallback(
    (id: string) => {
      dispatch({ type: "MINIMIZE", id });
    },
    [dispatch],
  );
  const restoreWindow = useCallback(
    (id: string) => {
      dispatch({ type: "RESTORE", id });
    },
    [dispatch],
  );
  const toggleMaximize = useCallback(
    (id: string) => {
      dispatch({ type: "MAXIMIZE_TOGGLE", id });
    },
    [dispatch],
  );
  const moveWindow = useCallback(
    (id: string, x: number, y: number) => {
      dispatch({ type: "MOVE", id, x, y });
    },
    [dispatch],
  );
  const resizeWindow = useCallback(
    (id: string, w: number, h: number) => {
      dispatch({ type: "RESIZE", id, w, h });
    },
    [dispatch],
  );
  const setBounds = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      dispatch({ type: "SET_BOUNDS", id, x, y, w, h });
    },
    [dispatch],
  );
  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      dispatch({ type: "SWITCH_WORKSPACE", workspaceId });
    },
    [dispatch],
  );
  const moveWindowToWorkspace = useCallback(
    (id: string, workspaceId: string) => {
      dispatch({ type: "MOVE_WINDOW_TO_WORKSPACE", id, workspaceId });
    },
    [dispatch],
  );
  const addWorkspace = useCallback(
    (workspaceId?: string) => {
      const id =
        workspaceId ??
        String(
          (state.workspaces.length === 0
            ? 1
            : Math.max(
                ...state.workspaces.map((w) => Number.parseInt(w, 10) || 0),
              ) + 1),
        );
      dispatch({ type: "ADD_WORKSPACE", workspaceId: id });
    },
    [dispatch, state.workspaces],
  );
  const removeWorkspace = useCallback(
    (workspaceId: string) => {
      dispatch({ type: "REMOVE_WORKSPACE", workspaceId });
    },
    [dispatch],
  );

  const focusedWindow = useMemo<OpenWindow | null>(() => {
    if (!state.focusedId) return null;
    return state.windows.find((w) => w.id === state.focusedId) ?? null;
  }, [state.focusedId, state.windows]);

  const windowById = useCallback(
    (id: string) => state.windows.find((w) => w.id === id),
    [state.windows],
  );

  return {
    state,
    windows: state.windows,
    focusedWindow,
    windowById,
    openWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    toggleMaximize,
    moveWindow,
    resizeWindow,
    setBounds,
    switchWorkspace,
    moveWindowToWorkspace,
    addWorkspace,
    removeWorkspace,
  };
}
