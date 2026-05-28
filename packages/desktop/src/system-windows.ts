import type { ComponentType } from "react";
import type { StorageAdapter, SystemWindowArgs } from "@react-ui-os/core";
import { Settings } from "./Settings";

export interface SystemWindowContentProps {
  focused: boolean;
  /**
   * Args passed via `openWindow({ kind: "system", systemId, args })`. Use
   * these when one system window definition handles multiple instances
   * (e.g. a single "Component" window powered by a `name` arg).
   */
  args?: SystemWindowArgs;
}

export interface SystemWindowDef {
  /**
   * Title shown in the title bar and menu bar. When a string, every
   * instance of this system window shares the title. When a function, the
   * title is derived per-instance from the args (useful for "Component:
   * Spotlight" vs "Component: Window").
   */
  name: string | ((args?: SystemWindowArgs) => string);
  /** Optional one-line subtitle for Spotlight. */
  tagline?: string;
  /** Accent color used by the top-edge highlight. */
  accent?: string;
  /** Default window bounds when first opened. */
  defaultBounds: { w: number; h: number };
  /** Window body component. Receives the optional args alongside focus. */
  content: ComponentType<SystemWindowContentProps>;
  /**
   * Controls whether this system window surfaces as a desktop shortcut icon.
   *
   *   undefined or false  no icon (the window is only reachable via Spotlight
   *                       or a keyboard shortcut, like Settings)
   *   true                always show the icon
   *   function            predicate evaluated against the storage adapter on
   *                       every storage-change event ("state-earned"). Returns
   *                       true to show the icon. The Recents / Downloads /
   *                       Presets pattern: an empty folder is invisible until
   *                       the user has put something in it.
   */
  appearsAsDesktopIcon?: boolean | ((storage: StorageAdapter) => boolean);
  /** Icon component painted on the desktop shortcut. Defaults to a folder. */
  desktopIcon?: ComponentType<{ size?: number }>;
}

/**
 * Registry of built-in system windows. Each is addressable by `payload:
 * { kind: "system", systemId: "<key>" }`. Consumers can extend this registry
 * with their own folders / system surfaces.
 */
export const systemWindows: Record<string, SystemWindowDef> = {
  settings: {
    name: "Settings",
    tagline: "Tweak the theme",
    accent: "#8a8a93",
    defaultBounds: { w: 560, h: 520 },
    content: Settings,
    // Settings doesn't get a desktop shortcut by default; it's expected to
    // be reached via Cmd-, or Spotlight. Consumers can override per-app.
  },
};

/** Register a new system window. Consumer apps call this once at startup. */
export function registerSystemWindow(
  systemId: string,
  def: SystemWindowDef,
): void {
  systemWindows[systemId] = def;
}

export function getSystemWindow(systemId: string): SystemWindowDef | undefined {
  return systemWindows[systemId];
}

/** List system windows in declaration order; useful for Spotlight. */
export function listSystemWindows(): Array<
  { systemId: string } & SystemWindowDef
> {
  return Object.entries(systemWindows).map(([systemId, def]) => ({
    systemId,
    ...def,
  }));
}

/**
 * Resolve the display name for a (possibly args-dependent) system window
 * definition. Used by the title bar, the menu bar, and Spotlight.
 */
export function resolveSystemWindowName(
  def: SystemWindowDef,
  args?: SystemWindowArgs,
): string {
  return typeof def.name === "function" ? def.name(args) : def.name;
}
