import type { Dispatch } from "react";

/**
 * What a window is showing. `app` windows host a user-registered app; `system`
 * windows host built-in surfaces (Settings, file explorers, etc.) that the
 * library will introduce in later phases.
 */
export type WindowPayload =
  | { kind: "app"; appId: string }
  | { kind: "system"; systemId: string };

export type WindowState = "normal" | "minimized" | "maximized";

export interface WindowBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OpenWindow {
  /** Stable id derived from payload. */
  id: string;
  payload: WindowPayload;
  state: WindowState;
  /** Pixel bounds for the normal (non-maximized) layout. Preserved across max/min cycles. */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export interface WindowManagerState {
  windows: OpenWindow[];
  /** Top-most non-minimized window id, or null when none. */
  focusedId: string | null;
  /** Next z-index to assign. The reducer increments monotonically. */
  nextZ: number;
}

/**
 * Stable id from payload. Opening the same app twice focuses the existing
 * window rather than spawning a duplicate, mirroring macOS app-instance
 * behavior. `system` windows behave the same per `systemId`.
 */
export function windowIdOf(payload: WindowPayload): string {
  if (payload.kind === "app") return `app:${payload.appId}`;
  return `system:${payload.systemId}`;
}

export interface WindowManagerActions {
  openWindow: (payload: WindowPayload, initialBounds?: WindowBounds) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, w: number, h: number) => void;
  setBounds: (id: string, x: number, y: number, w: number, h: number) => void;
}

export type WindowManagerAction =
  | { type: "OPEN"; payload: WindowPayload; initialBounds?: WindowBounds }
  | { type: "CLOSE"; id: string }
  | { type: "FOCUS"; id: string }
  | { type: "MINIMIZE"; id: string }
  | { type: "RESTORE"; id: string }
  | { type: "MAXIMIZE_TOGGLE"; id: string }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "RESIZE"; id: string; w: number; h: number }
  | { type: "SET_BOUNDS"; id: string; x: number; y: number; w: number; h: number };

export type WindowManagerDispatch = Dispatch<WindowManagerAction>;
