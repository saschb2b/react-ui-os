import type { OsTheme } from "@react-ui-os/core";
import { getViewportMode, type ViewportMode } from "./viewport-mode";

/**
 * Chrome metrics that change between regular and compact viewports. The
 * library reads these instead of importing fixed numbers so a small
 * embed (a docs iframe, a phone) gets tighter chrome automatically.
 */
export interface ChromeMetrics {
  menuBarHeight: number;
  dockTileSize: number;
  dockGap: number;
  dockPadding: number;
  dockEdgeOffset: number;
  /** Thickness of the edge-flush taskbar form (chrome.dockStyle "bar"). */
  taskbarSize: number;
  /** Icon-button size inside the taskbar form. */
  taskbarTileSize: number;
  titleBarHeight: number;
  /** Computed: the full bottom-dock footprint along its axis. */
  dockHeight: number;
  /** Computed: the full left-dock footprint along its axis. */
  dockWidth: number;
}

const REGULAR_METRICS = {
  // macOS Big Sur+ menu bar is 24pt; match it.
  menuBarHeight: 24,
  dockTileSize: 56,
  dockGap: 10,
  dockPadding: 10,
  dockEdgeOffset: 14,
  // Windows 11 taskbar default (Medium) is 48px; icons sit ~24px inside it.
  taskbarSize: 48,
  taskbarTileSize: 36,
  titleBarHeight: 32,
} as const;

const COMPACT_METRICS = {
  menuBarHeight: 22,
  dockTileSize: 40,
  dockGap: 6,
  dockPadding: 6,
  dockEdgeOffset: 8,
  taskbarSize: 40,
  taskbarTileSize: 30,
  titleBarHeight: 28,
} as const;

export function getChromeMetrics(
  mode: ViewportMode = getViewportMode(),
): ChromeMetrics {
  const base = mode === "compact" ? COMPACT_METRICS : REGULAR_METRICS;
  return {
    ...base,
    dockHeight: base.dockTileSize + base.dockPadding * 2,
    dockWidth: base.dockTileSize + base.dockPadding * 2,
  };
}

/* ─── Back-compat exports ───────────────────────────────────────
 * Existing call sites import these as plain numbers. We keep them
 * exporting the regular-mode constants so external consumers don't
 * break, but the library's own components read getChromeMetrics()
 * to stay responsive.
 */
export const MENU_BAR_HEIGHT = REGULAR_METRICS.menuBarHeight;
export const DOCK_TILE_SIZE = REGULAR_METRICS.dockTileSize;
export const DOCK_GAP = REGULAR_METRICS.dockGap;
export const DOCK_PADDING = REGULAR_METRICS.dockPadding;
export const DOCK_EDGE_OFFSET = REGULAR_METRICS.dockEdgeOffset;
export const DOCK_HEIGHT =
  REGULAR_METRICS.dockTileSize + REGULAR_METRICS.dockPadding * 2;
export const DOCK_WIDTH =
  REGULAR_METRICS.dockTileSize + REGULAR_METRICS.dockPadding * 2;

export interface WorkArea {
  /** Top-left corner of the work area in viewport coords. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getMenuBarHeight(theme: OsTheme): number {
  if (theme.chrome.menuBar === "none") return 0;
  return getChromeMetrics().menuBarHeight;
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
  const isBar = theme.chrome.dockStyle === "bar";
  // A hidden dock, or an auto-hiding bar that is currently tucked away, reserves
  // nothing: windows fill the space and the bar overlays them when it reveals.
  if (theme.chrome.dockPosition === "hidden" || (isBar && theme.chrome.dockAutoHide)) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const metrics = getChromeMetrics();
  // The taskbar form sits flush to the edge, so it reserves its own thickness
  // with no surrounding gap. The floating dock adds its edge offset.
  if (theme.chrome.dockPosition === "left") {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: isBar
        ? metrics.taskbarSize
        : metrics.dockWidth + metrics.dockEdgeOffset * 2,
    };
  }
  return {
    top: 0,
    right: 0,
    bottom: isBar ? metrics.taskbarSize : metrics.dockHeight + metrics.dockEdgeOffset,
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
