import type { ReactNode } from "react";

/**
 * The HUD is the small floating indicator the OS uses to confirm a
 * momentary action — "Snapped Left", "Maximized", "Volume 35%". Always
 * centered, always fades after a short hold, never blocks input. The
 * store is module-level so a snap handler, a hotkey, or a custom action
 * can fire it without prop-drilling.
 */

export interface HudPayload {
  /** Visible main line. Keep short — this is glyphic, not paragraph copy. */
  title: string;
  /** Optional second line. */
  sublabel?: string;
  /** Visual icon. A ReactNode lets consumers use their existing icon kit. */
  icon?: ReactNode;
  /**
   * Optional 0..1 progress bar drawn beneath the title. Useful for
   * volume / brightness analogues.
   */
  progress?: number;
  /**
   * Optional accent color override. Defaults to the theme accent.
   */
  accent?: string;
  /** Hold time in ms before the HUD fades out. Defaults to 1100. */
  duration?: number;
}

interface ActiveHud extends HudPayload {
  id: number;
  /** Wall-clock at which the HUD was triggered. */
  startedAt: number;
}

let active: ActiveHud | null = null;
const listeners = new Set<(value: ActiveHud | null) => void>();
let idCounter = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener(active);
}

/**
 * Show a HUD. Re-firing replaces the active one so quick repeated
 * actions (multiple brightness taps) coalesce into a single floating
 * indicator that updates in place.
 */
export function showHud(payload: HudPayload): void {
  idCounter += 1;
  active = {
    ...payload,
    id: idCounter,
    startedAt: Date.now(),
  };
  emit();
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(
    () => {
      active = null;
      hideTimer = null;
      emit();
    },
    Math.max(200, payload.duration ?? 1100),
  );
}

/** Hide immediately. Useful when a follow-up surface (toast, dialog) takes over. */
export function hideHud(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (active === null) return;
  active = null;
  emit();
}

export function getHud(): ActiveHud | null {
  return active;
}

export function subscribeHud(
  listener: (value: ActiveHud | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type { ActiveHud };
