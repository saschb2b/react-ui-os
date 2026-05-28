import type { OsTheme } from "@react-ui-os/core";

export const MENU_BAR_HEIGHT = 28;

export const DOCK_TILE_SIZE = 56;
export const DOCK_GAP = 10;
export const DOCK_PADDING = 10;
export const DOCK_EDGE_OFFSET = 14;

/** Footprint of the dock when it floats at the bottom. */
export const DOCK_HEIGHT = DOCK_TILE_SIZE + DOCK_PADDING * 2;
/** Footprint of the dock when it floats on the left edge. */
export const DOCK_WIDTH = DOCK_TILE_SIZE + DOCK_PADDING * 2;

export interface WorkArea {
  /** Top-left corner of the work area in viewport coords. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getMenuBarHeight(theme: OsTheme): number {
  return theme.chrome.menuBar === "none" ? 0 : MENU_BAR_HEIGHT;
}

/**
 * Pixel reservation each chrome surface takes out of the viewport. Used by
 * Window to compute the maximize fill rect and the drag clamp box.
 */
export function getDockReservation(theme: OsTheme): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (theme.chrome.dockPosition === "hidden") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (theme.chrome.dockPosition === "left") {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: DOCK_WIDTH + DOCK_EDGE_OFFSET * 2,
    };
  }
  return {
    top: 0,
    right: 0,
    bottom: DOCK_HEIGHT + DOCK_EDGE_OFFSET,
    left: 0,
  };
}

/**
 * Effective viewport rectangle apps can use without colliding with the menu
 * bar or the dock. Falls back to a small default on SSR.
 */
export function getWorkArea(theme: OsTheme): WorkArea {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: 800, height: 600 };
  }
  const menuH = getMenuBarHeight(theme);
  const dock = getDockReservation(theme);
  return {
    x: dock.left,
    y: menuH + dock.top,
    width: window.innerWidth - dock.left - dock.right,
    height: window.innerHeight - menuH - dock.top - dock.bottom,
  };
}
