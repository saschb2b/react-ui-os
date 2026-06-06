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
  /**
   * Peak scale of the hovered dock tile (the macOS fisheye magnification).
   * Optional: defaults to the macOS-like 1.5. Set to 1 to switch the fisheye
   * off entirely, the register a Windows taskbar or GNOME dash uses.
   */
  dockMagnification?: number;
  genieDurationMs: number;
  genieEasing: string;
  /**
   * Mission Control spread and collapse. Its own gesture, distinct from the
   * window open and genie pacing (the macOS expose zoom runs roughly 0.2 to
   * 0.25s).
   */
  missionControlDurationMs: number;
  missionControlEasing: string;
}

export interface OsThemeBlur {
  /** Backdrop-filter applied to surface chrome (menu bar, dock). */
  surface: string;
  /** Backdrop-filter applied to Spotlight. */
  spotlight: string;
}

export interface OsThemeElevation {
  /**
   * CSS `box-shadow` for the focused window (the deepest elevation). Shadows
   * convey lift only: keep them neutral (black at low alpha), never tinted.
   */
  windowFocused: string;
  /** CSS `box-shadow` for unfocused windows. Shallower than focused. */
  windowUnfocused: string;
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
  /**
   * Window title-bar control style. `"traffic-lights"` is the macOS trio on
   * the left; `"windows"` is the Windows 11 caption cluster flush in the
   * top-right corner; `"gnome"` is the Adwaita/Yaru trio of round symbolic
   * buttons on the right; `"minimal"` is a single close affordance.
   */
  windowControls: "traffic-lights" | "windows" | "gnome" | "minimal";
  dockPosition: "bottom" | "left" | "hidden";
  /**
   * Dock form. `"floating"` is the macOS dock: a centered rounded pill that
   * hovers above the edge with a gap. `"bar"` is the Windows taskbar / GNOME
   * panel shape: a flat bar flush to the edge, spanning the full width (bottom)
   * or height (left), square corners, an accent underline under running apps.
   * Optional, defaults to `"floating"`. Ignored when `dockPosition` is
   * `"hidden"`.
   */
  dockStyle?: "floating" | "bar";
  /**
   * Presentation of the app launcher / search surface. `"spotlight"` (default)
   * is the macOS centered command palette; `"grid"` is the GNOME Activities
   * app-grid overview (a full-bleed search field over a grid of app icons);
   * `"menu"` is the Windows Start menu (a panel anchored above the dock
   * launcher with a search field and a grid of app tiles). All three share the
   * same results (apps, system windows, and `registerSpotlightSource` rows) and
   * the same Cmd/Ctrl+K shortcut; only the layout changes. Build a fully custom
   * launcher with the exported `useLauncher` hook.
   */
  launcher?: "spotlight" | "grid" | "menu";
  /**
   * How a `"bar"` dock packs its app icons along its long axis. `"center"`
   * (default) is the macOS / Windows 11 placement; `"start"` packs them at the
   * top (left dock) or left (bottom dock), the GNOME / Ubuntu and Windows 10
   * placement, leaving the launcher at the far end; `"end"` packs them at the
   * far end. Ignored by the `"floating"` dock, whose pill always hugs its
   * icons. Windows 11 exposes the same lever as "Taskbar alignment".
   */
  dockAlign?: "start" | "center" | "end";
  menuBar: "top" | "in-window" | "none";
  /**
   * Where the clock sits in the top menu bar. `"right"` (default) is the macOS
   * placement, in the status cluster. `"center"` adopts the GNOME top-bar
   * arrangement: the clock and date sit centered, the workspace switcher moves
   * to the left, and the status indicators stay on the right. Ignored unless
   * `menuBar` is `"top"`.
   */
  menuBarClock?: "right" | "center";
  /**
   * Whether the top menu bar carries the brand button on the left (the macOS
   * Apple-menu analog that opens About / Settings). Defaults to true. A
   * GNOME-style theme sets false: the top-left then holds only the workspace
   * switcher, and system actions stay reachable through Quick Settings,
   * Spotlight, and the keyboard. Ignored unless `menuBar` is `"top"`.
   */
  menuBarBrand?: boolean;
  /**
   * When true, the menu-bar status cluster becomes a single button that opens
   * the Quick Settings popover (the GNOME system menu, the macOS Control
   * Center, the Windows quick settings flyout). Populate the popover with
   * `registerQuickSetting(...)`. Optional, defaults to false. Ignored unless
   * `menuBar` is `"top"`.
   */
  quickSettings?: boolean;
}

/** A resolved appearance (after "auto" is mapped to the system scheme). */
export type ResolvedAppearance = "light" | "dark";

/** The appearance a theme prefers. "auto" follows the OS color scheme. */
export type ThemeAppearance = ResolvedAppearance | "auto";

/**
 * Token overrides for an appearance variant. Only the visual tokens that
 * differ between light and dark are listed; everything else is inherited from
 * the base (light) theme. The desktop overlays these when the resolved
 * appearance calls for them.
 */
export interface OsThemeAppearance {
  palette?: Partial<OsThemePalette>;
  elevation?: OsThemeElevation;
  blur?: Partial<OsThemeBlur>;
  wallpaper?: Partial<OsThemeWallpaper>;
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
  /**
   * Window drop shadows. Optional: when a theme omits this, the components
   * fall back to the neutral default elevation. A flat or retro theme can set
   * both to `"none"`; a cinematic theme can deepen them.
   */
  elevation?: OsThemeElevation;
  wallpaper: OsThemeWallpaper;
  chrome: OsThemeChrome;
  /**
   * Preferred appearance. "auto" (the recommended default) follows the OS
   * color scheme via `prefers-color-scheme`; "light"/"dark" force one. The
   * desktop resolves this and, when the result is dark, overlays
   * `appearances.dark`. Omitted means the theme has a single (light) look.
   */
  appearance?: ThemeAppearance;
  /**
   * Optional appearance variants. A theme authors its base palette in whichever
   * mode is natural (macOS and Windows are light, Ubuntu is dark) and supplies
   * the opposite mode here. When the resolved appearance matches a key present,
   * its tokens overlay the base ones, so one object carries a light and a dark
   * look. Expose `"appearance"` as a `customizable` select to let the end user
   * switch between them.
   */
  appearances?: { light?: OsThemeAppearance; dark?: OsThemeAppearance };
  /**
   * End-user tweakable subset of the theme. Keys are dotted paths into the
   * theme object (e.g. `"palette.accent"`, `"shape.dockTileRadius"`). The
   * Settings system app reads this map and renders one field per entry; the
   * library persists the chosen value via the storage adapter and overlays
   * it on top of the theme defaults to produce the effective theme.
   *
   * A theme that omits this field exposes no settings panel. A theme that
   * supplies ten entries gets a ten-field panel for free.
   */
  customizable?: Record<string, CustomizableField>;
}

/* ─── Customizable schema ─────────────────────────────────────── */

interface CustomizableBase {
  /** Visible label shown in the Settings panel. */
  label: string;
  /** Optional helper copy under the label. */
  description?: string;
  /**
   * Logical grouping for the Settings panel. Defaults to "General".
   * Fields with the same `section` value render together.
   */
  section?: string;
}

export interface ColorFromPaletteField extends CustomizableBase {
  kind: "color-from-palette";
  /** Hex / CSS color strings the user picks from. */
  options: string[];
}

export interface ImagePickField extends CustomizableBase {
  kind: "image-pick";
  options: Array<{ src: string; label: string }>;
}

export interface RangeField extends CustomizableBase {
  kind: "range";
  min: number;
  max: number;
  step: number;
  /** Optional unit suffix shown next to the numeric readout. */
  unit?: string;
}

export interface SelectField extends CustomizableBase {
  kind: "select";
  options: Array<{ value: string; label: string }>;
}

export interface ToggleField extends CustomizableBase {
  kind: "toggle";
}

export type CustomizableField =
  | ColorFromPaletteField
  | ImagePickField
  | RangeField
  | SelectField
  | ToggleField;

/** User-chosen overrides keyed by the same dotted paths used by `customizable`. */
export type SettingsPrefs = Record<string, unknown>;
