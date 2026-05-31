import type {
  App,
  OsTheme,
  WindowBounds,
  WindowManagerState,
  WindowPayload,
} from "@react-ui-os/core";
import { getSystemWindow } from "../system-windows";
import { getChromeMetrics, getWorkArea, type WorkArea } from "./layout";

/**
 * Cascade slot the next window opened on the active workspace will occupy: the
 * number of windows already living there. A freshly opened window stacks on
 * top of exactly those, so the count is its position down the diagonal. The
 * open surfaces (dock, Spotlight, menu bar, keyboard shortcuts, ...) pass this
 * to {@link pickInitialBounds} so successive launches step down and to the
 * right instead of piling up dead-center.
 */
export function nextCascadeIndex(state: WindowManagerState): number {
  return state.windows.filter((w) => w.workspaceId === state.activeWorkspaceId).length;
}

/**
 * Pick a sensible initial position + size for a new window.
 *
 *   - If the consumer passed explicit bounds, clamp them to the work
 *     area but otherwise honor them.
 *   - Otherwise prefer the App's or SystemWindowDef's `defaultBounds`
 *     and center them in the work area.
 *   - Otherwise fall back to a 720×480 desktop default, centered, and
 *     capped at 90% of the work area so it never overflows a tiny
 *     viewport (LivePreview iframe, narrow phone, etc).
 *
 * Centering matters because a fixed `(80, 80)` default looks fine on a
 * 1440×900 desktop but spawns the entire window into a 760×460 docs
 * iframe with no breathing room around it.
 *
 * `cascadeIndex` staggers successive auto-placed windows so they don't stack
 * dead-center on top of each other: index 0 is centered, every later window
 * steps down and to the right. See {@link cascadeOrigin}.
 */
export function pickInitialBounds(
  payload: WindowPayload,
  theme: OsTheme,
  apps: App[],
  explicit?: WindowBounds,
  cascadeIndex = 0,
): WindowBounds {
  const work = getWorkArea(theme);
  const margin = 12;
  const maxW = Math.max(240, work.width - margin * 2);
  const maxH = Math.max(160, work.height - margin * 2);

  if (explicit) {
    const w = Math.min(explicit.w, maxW);
    const h = Math.min(explicit.h, maxH);
    const x = clamp(explicit.x, work.x + margin, work.x + work.width - w - margin);
    const y = clamp(explicit.y, work.y + margin, work.y + work.height - h - margin);
    return { x, y, w, h };
  }

  const preferred = preferredSizeFor(payload, apps);
  const w = Math.min(preferred.w, maxW);
  const h = Math.min(preferred.h, maxH);
  const centerX = Math.round(work.x + (work.width - w) / 2);
  const centerY = Math.round(work.y + (work.height - h) / 2);
  const { x, y } = cascadeOrigin(centerX, centerY, w, h, work, margin, cascadeIndex);
  return { w, h, x, y };
}

/**
 * Walk a diagonal cascade from a centered anchor, the way macOS, Windows, and
 * GNOME all stagger newly opened windows so each prior title bar stays visible.
 *
 * Index 0 sits exactly at the centered anchor. Each later window steps one
 * title-bar height down and to the right, the same delta AppKit's
 * `NSWindow.cascadeTopLeft(from:)` uses (it returns a point offset by the
 * title-bar height precisely so the next window won't cover the previous
 * window's title bar). When the next step would push the window past the
 * bottom edge, the cascade wraps back up to the top, having already drifted
 * right, so a new column starts further over. A column that would run off the
 * right edge wraps back to the left. The result fills the work area instead of
 * piling every window in one spot.
 */
function cascadeOrigin(
  centerX: number,
  centerY: number,
  w: number,
  h: number,
  work: WorkArea,
  margin: number,
  index: number,
): { x: number; y: number } {
  if (index <= 0) return { x: centerX, y: centerY };
  const step = getChromeMetrics().titleBarHeight;
  const topY = work.y + margin;
  const leftX = work.x + margin;
  const bottomLimit = work.y + work.height - margin;
  const rightLimit = work.x + work.width - margin;
  let x = centerX;
  let y = centerY;
  for (let i = 0; i < index; i++) {
    x += step;
    y += step;
    // Out of vertical room: jump back to the top. x keeps the rightward drift
    // it has accumulated, so the new column lands further over.
    if (y + h > bottomLimit) y = topY;
    // Out of horizontal room: back to the left edge.
    if (x + w > rightLimit) x = leftX;
  }
  return { x, y };
}

function preferredSizeFor(
  payload: WindowPayload,
  apps: App[],
): { w: number; h: number } {
  if (payload.kind === "app") {
    const app = apps.find((a) => a.id === payload.appId);
    if (app?.defaultBounds) return app.defaultBounds;
  } else {
    const def = getSystemWindow(payload.systemId);
    if (def?.defaultBounds) return def.defaultBounds;
  }
  return { w: 720, h: 480 };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
