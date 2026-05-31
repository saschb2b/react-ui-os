"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import { initialWindowManagerState, windowManagerReducer } from "./reducer";
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

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(windowManagerReducer, initialWindowManagerState);
  const value: WindowManagerContextValue = { state, dispatch };
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
    throw new Error("useWindowManager must be used within a WindowManagerProvider");
  }
  const { state, dispatch } = ctx;

  // These action wrappers and derived values were hand-memoized for stable
  // identity. The React Compiler now memoizes them, so they are plain
  // functions and expressions here.
  const openWindow = (payload: WindowPayload, initialBounds?: WindowBounds) => {
    dispatch({ type: "OPEN", payload, initialBounds });
  };
  const closeWindow = (id: string) => {
    dispatch({ type: "CLOSE", id });
  };
  const focusWindow = (id: string) => {
    dispatch({ type: "FOCUS", id });
  };
  const minimizeWindow = (id: string) => {
    dispatch({ type: "MINIMIZE", id });
  };
  const restoreWindow = (id: string) => {
    dispatch({ type: "RESTORE", id });
  };
  const toggleMaximize = (id: string) => {
    dispatch({ type: "MAXIMIZE_TOGGLE", id });
  };
  const moveWindow = (id: string, x: number, y: number) => {
    dispatch({ type: "MOVE", id, x, y });
  };
  const resizeWindow = (id: string, w: number, h: number) => {
    dispatch({ type: "RESIZE", id, w, h });
  };
  const setBounds = (id: string, x: number, y: number, w: number, h: number) => {
    dispatch({ type: "SET_BOUNDS", id, x, y, w, h });
  };
  const switchWorkspace = (workspaceId: string) => {
    dispatch({ type: "SWITCH_WORKSPACE", workspaceId });
  };
  const moveWindowToWorkspace = (id: string, workspaceId: string) => {
    dispatch({ type: "MOVE_WINDOW_TO_WORKSPACE", id, workspaceId });
  };
  const addWorkspace = (workspaceId?: string) => {
    const id =
      workspaceId ??
      String(
        state.workspaces.length === 0
          ? 1
          : Math.max(...state.workspaces.map((w) => Number.parseInt(w, 10) || 0)) + 1,
      );
    dispatch({ type: "ADD_WORKSPACE", workspaceId: id });
  };
  const removeWorkspace = (workspaceId: string) => {
    dispatch({ type: "REMOVE_WORKSPACE", workspaceId });
  };

  const focusedWindow: OpenWindow | null = state.focusedId
    ? (state.windows.find((w) => w.id === state.focusedId) ?? null)
    : null;

  const windowById = (id: string) => state.windows.find((w) => w.id === id);

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
