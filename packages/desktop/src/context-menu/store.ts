import type { ReactNode } from "react";

/**
 * Module-level context-menu store. One active menu at a time — opening
 * a new menu closes whatever was open before. Vanilla because callers
 * dispatch from anywhere (an onContextMenu handler, an effect, a
 * keyboard shortcut). React reads via useSyncExternalStore.
 */

export interface ContextMenuItem {
  /** Rendered label. Use `separator: true` instead of a label for dividers. */
  label?: string;
  /** Visual leading icon (small, ~14px). */
  icon?: ReactNode;
  /** Right-aligned shortcut hint, e.g. "⌘N" or "F2". */
  shortcut?: string;
  /** Handler. The menu closes after this runs. */
  onSelect?: () => void;
  /** Greys out the row and skips it during keyboard navigation. */
  disabled?: boolean;
  /** Tints the row red. Usually sits below a separator. */
  danger?: boolean;
  /** Renders a divider in place of a normal row. */
  separator?: boolean;
  /** Optional nested submenu. Hovering opens it; arrow-right enters. */
  submenu?: ContextMenuItem[];
}

export interface ContextMenuState {
  /** Page coordinates where the menu should anchor. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Accessibility label for the menu container. */
  ariaLabel?: string;
  /** Optional element that opened the menu — focus returns here on close. */
  returnFocusTo?: HTMLElement | null;
}

let active: ContextMenuState | null = null;
const listeners = new Set<(state: ContextMenuState | null) => void>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

export function openContextMenu(state: ContextMenuState): void {
  active = state;
  emit();
}

export function closeContextMenu(): void {
  if (!active) return;
  const returnTo = active.returnFocusTo;
  active = null;
  emit();
  if (returnTo) {
    try {
      returnTo.focus();
    } catch {
      // Element may have been unmounted; nothing to focus.
    }
  }
}

export function getContextMenuState(): ContextMenuState | null {
  return active;
}

export function subscribeContextMenu(
  listener: (state: ContextMenuState | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset. */
export function __resetContextMenu(): void {
  active = null;
}
