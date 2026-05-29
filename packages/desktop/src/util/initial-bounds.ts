import type { App, OsTheme, WindowBounds, WindowPayload } from "@react-ui-os/core";
import { getSystemWindow } from "../system-windows";
import { getWorkArea } from "./layout";

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
 */
export function pickInitialBounds(
  payload: WindowPayload,
  theme: OsTheme,
  apps: App[],
  explicit?: WindowBounds,
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
  return {
    w,
    h,
    x: Math.round(work.x + (work.width - w) / 2),
    y: Math.round(work.y + (work.height - h) / 2),
  };
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
