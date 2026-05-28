import type { ComponentType } from "react";
import { Settings } from "./Settings";

export interface SystemWindowDef {
  /** Title shown in the title bar and menu bar. */
  name: string;
  /** Optional one-line subtitle for Spotlight. */
  tagline?: string;
  /** Accent color used by the top-edge highlight. */
  accent?: string;
  /** Default window bounds when first opened. */
  defaultBounds: { w: number; h: number };
  /** Window body component. */
  content: ComponentType<{ focused: boolean }>;
}

/**
 * Registry of built-in system windows. Each is addressable by `payload:
 * { kind: "system", systemId: "<key>" }`. Settings is the only one shipped
 * today; future entries (Spotlight history, file explorers, system
 * monitor) will register here.
 */
export const systemWindows: Record<string, SystemWindowDef> = {
  settings: {
    name: "Settings",
    tagline: "Tweak the theme",
    accent: "#8a8a93",
    defaultBounds: { w: 560, h: 520 },
    content: Settings,
  },
};

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
