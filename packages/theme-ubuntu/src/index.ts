import type { OsTheme } from "@react-ui-os/core";

export interface UbuntuThemeOptions {
  /**
   * Accent override. Defaults to the Yaru orange (#E95420). The Yaru theme
   * ships ten accents; the customizable panel offers a subset.
   */
  accent?: string;
  /**
   * Wallpaper image url. Themes do not bundle assets; the consumer supplies
   * the path. When omitted, the dark Yaru background fills the desktop.
   */
  wallpaperSrc?: string;
}

/**
 * GNOME / Ubuntu register, the third structural pole alongside the macOS
 * default and the Windows theme. It combines two levers no single
 * earlier theme used together: a top menu bar AND a left dock, the GNOME
 * Shell arrangement. The clock sits centered in the bar, the status cluster
 * opens a Quick Settings popover on the right, the dock is a flat bar flush to
 * the left edge with no fisheye, and windows wear the Adwaita/Yaru round
 * symbolic controls on the right.
 *
 * Colors follow Yaru dark and the standard Ubuntu orange. Shape follows
 * libadwaita: 12px top-level window corners, 8px controls.
 * Sources: Yaru accent palette (orange #E95420, https://github.com/ubuntu/yaru);
 * libadwaita window radius and the GNOME default button-layout
 * ":minimize,maximize,close"; GNOME Shell easing (ease-out-quad ~250ms for the
 * overview, ~200ms for window open).
 *
 * Returns a fresh theme object on each call so caller customizations never
 * leak between consumers.
 */
export function createUbuntuTheme(options: UbuntuThemeOptions = {}): OsTheme {
  const accent = options.accent ?? "#E95420";
  return {
    id: "ubuntu",
    name: "Ubuntu",
    palette: {
      // Yaru dark: a near-black desktop, dark gray translucent chrome, white
      // text, and the orange accent.
      background: "#1e1e1e",
      surface: "rgba(38, 38, 38, 0.9)",
      // Hex (not rgba) so the components' `${textPrimary}1a` alpha-append trick
      // for hover tints and tile fills produces a valid 8-digit color.
      textPrimary: "#ffffff",
      textSecondary: "rgba(255, 255, 255, 0.6)",
      accent,
      border: "rgba(255, 255, 255, 0.1)",
    },
    shape: {
      // libadwaita rounds top-level windows at 12px; controls and pills sit at
      // 8px. The dock and quick-toggle tiles use the larger 16px tile radius.
      windowRadius: 12,
      dockTileRadius: 16,
      small: 8,
    },
    motion: {
      // GNOME Shell window open is a brief ease-out; the overview runs ~250ms.
      // ease-out-quad approximated as a cubic-bezier.
      windowOpenDurationMs: 200,
      windowOpenEasing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      dockHoverDurationMs: 120,
      // The Ubuntu dock does not magnify on hover; turn the fisheye off.
      dockMagnification: 1,
      genieDurationMs: 220,
      genieEasing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      missionControlDurationMs: 250,
      missionControlEasing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    },
    blur: {
      // The shell chrome and the system menu are dark and lightly translucent.
      surface: "blur(24px) saturate(120%)",
      spotlight: "blur(24px) saturate(120%)",
    },
    elevation: {
      // GNOME floats windows on a soft, deep neutral shadow.
      windowFocused:
        "0 16px 40px -12px rgba(0,0,0,0.6), 0 4px 12px -4px rgba(0,0,0,0.4)",
      windowUnfocused: "0 8px 24px -12px rgba(0,0,0,0.45)",
    },
    wallpaper: {
      src: options.wallpaperSrc,
      // GNOME has no cursor parallax.
      parallax: false,
      vignette: false,
    },
    chrome: {
      windowControls: "gnome",
      dockPosition: "left",
      dockStyle: "bar",
      // The GNOME Activities app-grid overview, not the macOS palette.
      launcher: "grid",
      // Ubuntu packs the app icons from the top, launcher pinned at the bottom.
      dockAlign: "start",
      menuBar: "top",
      menuBarClock: "center",
      // GNOME has no Apple-style brand menu; the top-left is just workspaces.
      menuBarBrand: false,
      quickSettings: true,
    },
    customizable: {
      "palette.accent": {
        kind: "color-from-palette",
        section: "Appearance",
        label: "Accent",
        description:
          "The Yaru accent. Tints the dock indicators, the focused-window highlight, and active toggles.",
        // A subset of the ten Yaru accents.
        options: ["#E95420", "#77216f", "#3584e4", "#0e8420", "#c748ba", "#c7162b"],
      },
      "shape.windowRadius": {
        kind: "range",
        section: "Appearance",
        label: "Window radius",
        min: 0,
        max: 18,
        step: 1,
        unit: "px",
      },
      "chrome.windowControls": {
        kind: "select",
        section: "Layout",
        label: "Window controls",
        options: [
          { value: "gnome", label: "GNOME" },
          { value: "traffic-lights", label: "macOS" },
          { value: "windows", label: "Windows" },
          { value: "minimal", label: "Minimal" },
        ],
      },
      "chrome.dockPosition": {
        kind: "select",
        section: "Layout",
        label: "Dock position",
        options: [
          { value: "left", label: "Left" },
          { value: "bottom", label: "Bottom" },
          { value: "hidden", label: "Hidden" },
        ],
      },
      "chrome.dockAlign": {
        kind: "select",
        section: "Layout",
        label: "Dock icon alignment",
        description: "Where the app icons sit along the dock.",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
        ],
      },
      "chrome.menuBarClock": {
        kind: "select",
        section: "Layout",
        label: "Clock placement",
        options: [
          { value: "center", label: "Center (GNOME)" },
          { value: "right", label: "Right (macOS)" },
        ],
      },
      "motion.windowOpenDurationMs": {
        kind: "range",
        section: "Motion",
        label: "Window open speed",
        min: 0,
        max: 400,
        step: 20,
        unit: "ms",
      },
    },
  };
}

export type { OsTheme } from "@react-ui-os/core";
