import type { ComponentType } from "react";

/**
 * Public face of an app installed in the desktop.
 *
 * Apps are the central registry: a single object describing one of these is
 * picked up by the dock, the menu bar, Spotlight, keyboard shortcuts, and any
 * other surface that knows how to look at the app list. Contributing to one
 * place contributes to all of them.
 */
export interface App {
  /** URL- and css-safe id. Used as the stable window id (`app:<id>`). */
  id: string;
  /** Human-readable name shown in the dock, menu bar, and Spotlight. */
  name: string;
  /** Optional one-line subtitle for Spotlight and dock tooltips. */
  tagline?: string;
  /**
   * Accent color. Themes use it to tint the dock tile gradient, the window
   * top-edge highlight, and the menu-bar status dot when this app is focused.
   * When absent, the theme's default accent is used.
   */
  accent?: string;
  /** Lucide-style icon. Themes render a fallback letter when absent. */
  icon?: ComponentType<{ size?: number }>;
  /**
   * Subject illustration painted inside the dock tile, on top of the accent
   * gradient. Optional; themes fall back to `icon` or a letter.
   */
  iconArt?: ComponentType<{ size?: number }>;
  /** Default window bounds when first opened. Theme has the fallback. */
  defaultBounds?: { w: number; h: number };
  /** The window's body. */
  content: ComponentType<AppContentProps>;
}

export interface AppContentProps {
  appId: string;
  /** True if this window is the currently focused one. */
  focused: boolean;
}

/* ─── Theme ───────────────────────────────────────────────────── */

export interface OsThemePalette {
  /** Fallback background when no wallpaper is set. */
  background: string;
  /** Surface tint applied to menu bar, dock, and window chrome. */
  surface: string;
  /** Primary text color on surfaces. */
  textPrimary: string;
  /** Secondary / muted text. */
  textSecondary: string;
  /** Default accent. Apps may override per-app. */
  accent: string;
  /** Border / hairline color. */
  border: string;
}

export interface OsThemeShape {
  windowRadius: number;
  dockTileRadius: number;
  /** Small radius for pills, tooltips, menu-bar chips. */
  small: number;
}

export interface OsThemeMotion {
  windowOpenDurationMs: number;
  windowOpenEasing: string;
  dockHoverDurationMs: number;
  genieDurationMs: number;
  genieEasing: string;
}

export interface OsThemeBlur {
  /** Backdrop-filter applied to surface chrome (menu bar, dock). */
  surface: string;
  /** Backdrop-filter applied to Spotlight. */
  spotlight: string;
}

export interface OsThemeWallpaper {
  /** Wallpaper image url. When absent, the palette background fills the desktop. */
  src?: string;
  /** Enables cursor-driven parallax. */
  parallax?: boolean;
  /** Adds a dark vignette over the wallpaper. */
  vignette?: boolean;
}

export interface OsThemeChrome {
  windowControls: "traffic-lights" | "windows" | "minimal";
  dockPosition: "bottom" | "left" | "hidden";
  menuBar: "top" | "in-window" | "none";
}

export interface OsTheme {
  /** Theme id for storage namespacing. */
  id: string;
  /** Display name shown in dev tooling. */
  name: string;
  palette: OsThemePalette;
  shape: OsThemeShape;
  motion: OsThemeMotion;
  blur: OsThemeBlur;
  wallpaper: OsThemeWallpaper;
  chrome: OsThemeChrome;
}
