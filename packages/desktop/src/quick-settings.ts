import type { ReactNode } from "react";

/**
 * Quick settings populate the popover that drops from the menu-bar status
 * cluster: the GNOME system menu, the macOS Control Center, the Windows quick
 * settings flyout. All three are the same shape, a small panel of toggle
 * tiles, a slider or two, and a row of action buttons (settings, lock, power),
 * so the library owns the visuals and consumers contribute data.
 *
 * The contract mirrors `registerStatusItem`: register from any code, get back
 * an unsubscribe, components subscribe via `useSyncExternalStore`. Items are
 * controlled, they carry their current `active` / `value`; re-register the
 * same id to update (the QuickSettings component reads the item as the source
 * of truth and calls the item's handler on interaction). Items render in
 * declared `order`, low-first, grouped by kind: actions in the header row,
 * sliders next, toggle tiles in a two-column grid.
 */

interface QuickSettingBase {
  /** Stable id used as the React key and the dedup token. */
  id: string;
  /** Render order within its group. Lower first. Defaults to 100. */
  order?: number;
}

export interface QuickSettingToggle extends QuickSettingBase {
  kind: "toggle";
  label: string;
  /** Secondary line under the label ("Balanced", "Wired"). */
  sublabel?: string;
  /** Leading glyph, ~16px. */
  icon?: ReactNode;
  /** Current on/off state. Controlled: re-register to change it. */
  active?: boolean;
  onToggle?: (next: boolean) => void;
  /**
   * Optional secondary affordance shown as a trailing chevron, the GNOME
   * "expand into a sub-menu" arrow (e.g. Wired › opens network details).
   */
  onExpand?: () => void;
}

export interface QuickSettingSlider extends QuickSettingBase {
  kind: "slider";
  ariaLabel: string;
  /** Leading glyph, ~16px (a speaker, a sun). */
  icon?: ReactNode;
  /** Current value in the 0..1 range. Controlled: re-register to change it. */
  value: number;
  onChange?: (next: number) => void;
}

export interface QuickSettingAction extends QuickSettingBase {
  kind: "action";
  /** Glyph, ~16px. */
  icon: ReactNode;
  tooltip?: string;
  onClick?: () => void;
  /** Header alignment. `"start"` sits at the left, `"end"` (default) at the right. */
  align?: "start" | "end";
}

export type QuickSettingItem =
  | QuickSettingToggle
  | QuickSettingSlider
  | QuickSettingAction;

const items = new Map<string, QuickSettingItem>();
const listeners = new Set<() => void>();
// Cached snapshot so getSnapshot returns a stable reference between
// mutations (see status-items.ts for why this matters to useSyncExternalStore).
let cachedSnapshot: QuickSettingItem[] = [];

function rebuildSnapshot(): void {
  cachedSnapshot = Array.from(items.values()).sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100),
  );
}

function emit(): void {
  rebuildSnapshot();
  for (const listener of listeners) listener();
}

/**
 * Register a quick-settings entry. Returns an unsubscribe. Re-registering the
 * same id replaces the previous record, so a controller can flip a toggle or
 * move a slider by registering again with the new value.
 */
export function registerQuickSetting(item: QuickSettingItem): () => void {
  items.set(item.id, item);
  emit();
  return () => {
    if (items.get(item.id) === item) {
      items.delete(item.id);
      emit();
    }
  };
}

/** Remove an entry by id. */
export function unregisterQuickSetting(id: string): void {
  if (!items.has(id)) return;
  items.delete(id);
  emit();
}

export function listQuickSettings(): QuickSettingItem[] {
  return cachedSnapshot;
}

export function subscribeQuickSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
