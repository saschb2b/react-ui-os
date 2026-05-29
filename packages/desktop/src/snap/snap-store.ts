import type { WorkArea } from "../util/layout";

/**
 * Window snapping (Aero Snap). During a drag the pointer's vicinity to a
 * viewport edge or corner picks a snap zone. The SnapPreview overlay reads
 * the active zone from this store; the Window's pointerup handler reads
 * the resolved rect and applies it via setBounds.
 *
 * Vanilla store so the Window and the SnapPreview don't have to share a
 * provider, the same pattern notifications and the context menu use.
 */

export type SnapZone =
  | "left-half"
  | "right-half"
  | "top-max"
  | "top-left-quarter"
  | "top-right-quarter"
  | "bottom-left-quarter"
  | "bottom-right-quarter";

export interface SnapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapState {
  /** Window id being snapped. */
  windowId: string;
  zone: SnapZone;
  /** Resolved target rectangle in viewport coords. */
  rect: SnapRect;
}

let active: SnapState | null = null;
const listeners = new Set<(state: SnapState | null) => void>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

export function setSnapPreview(state: SnapState | null): void {
  if (active === null && state === null) return;
  if (
    active &&
    state &&
    active.windowId === state.windowId &&
    active.zone === state.zone
  ) {
    return;
  }
  active = state;
  emit();
}

export function getSnapPreview(): SnapState | null {
  return active;
}

export function subscribeSnapPreview(
  listener: (state: SnapState | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EDGE_THRESHOLD = 24;
const CORNER_THRESHOLD = 48;

/**
 * Map a pointer position inside `work` to a snap zone, or null if outside
 * the activation thresholds.
 *
 * Layout intent (mirrors Windows Snap / macOS edge drag):
 *
 *   ┌──────────────┬──────────────┐
 *   │ TL quarter   │ TR quarter   │
 *   │              │              │
 *   ├──────────────┴──────────────┤
 *   │   top edge → maximize       │
 *   │                             │
 *   │ left edge ── ── right edge  │
 *   │   half-left   half-right    │
 *   │                             │
 *   ├──────────────┬──────────────┤
 *   │ BL quarter   │ BR quarter   │
 *   └──────────────┴──────────────┘
 */
export function computeSnapZone(
  pointerX: number,
  pointerY: number,
  work: WorkArea,
): SnapZone | null {
  const top = pointerY <= work.y + EDGE_THRESHOLD;
  const bottom = pointerY >= work.y + work.height - EDGE_THRESHOLD;
  const left = pointerX <= work.x + EDGE_THRESHOLD;
  const right = pointerX >= work.x + work.width - EDGE_THRESHOLD;

  // Corners take precedence over edges when the pointer is well inside the
  // corner window. Windows behaves the same way.
  const cornerLeft = pointerX <= work.x + CORNER_THRESHOLD;
  const cornerRight = pointerX >= work.x + work.width - CORNER_THRESHOLD;

  if (top && cornerLeft) return "top-left-quarter";
  if (top && cornerRight) return "top-right-quarter";
  if (bottom && cornerLeft) return "bottom-left-quarter";
  if (bottom && cornerRight) return "bottom-right-quarter";
  if (top) return "top-max";
  if (left) return "left-half";
  if (right) return "right-half";
  return null;
}

/** Resolve a snap zone to a target rectangle inside the given work area. */
export function rectForZone(zone: SnapZone, work: WorkArea): SnapRect {
  const halfW = Math.floor(work.width / 2);
  const halfH = Math.floor(work.height / 2);
  switch (zone) {
    case "left-half":
      return { x: work.x, y: work.y, w: halfW, h: work.height };
    case "right-half":
      return {
        x: work.x + work.width - halfW,
        y: work.y,
        w: halfW,
        h: work.height,
      };
    case "top-max":
      return { x: work.x, y: work.y, w: work.width, h: work.height };
    case "top-left-quarter":
      return { x: work.x, y: work.y, w: halfW, h: halfH };
    case "top-right-quarter":
      return {
        x: work.x + work.width - halfW,
        y: work.y,
        w: halfW,
        h: halfH,
      };
    case "bottom-left-quarter":
      return {
        x: work.x,
        y: work.y + work.height - halfH,
        w: halfW,
        h: halfH,
      };
    case "bottom-right-quarter":
      return {
        x: work.x + work.width - halfW,
        y: work.y + work.height - halfH,
        w: halfW,
        h: halfH,
      };
  }
}
