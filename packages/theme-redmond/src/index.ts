import type { OsTheme } from "@react-ui-os/core";

export interface RedmondThemeOptions {
  /**
   * Optional accent override. Defaults to the Windows 11 "Default blue"
   * (#0078d4). Used as the system-wide accent fallback when no per-app
   * accent is set.
   */
  accent?: string;
  /**
   * URL of the wallpaper image. Themes do not bundle assets; the consumer
   * supplies the path. When omitted, the desktop falls back to the light
   * palette background.
   */
  wallpaperSrc?: string;
}

/**
 * Windows-style register. Where the default theme reads as macOS, this one
 * exercises the non-macOS levers end to end: caption buttons instead of
 * traffic lights (`chrome.windowControls: "windows"`), a bottom taskbar with
 * no fisheye (`motion.dockMagnification: 1`), no global menu bar, softly
 * rounded corners, and the lighter drop shadow of a flat light surface. It is
 * proof that the same components carry a desktop that is not a Mac.
 *
 * Values follow the Windows 11 Fluent design: 8px top-level corner radius,
 * Mica-light surfaces, the #0078d4 default accent, and soft neutral shadows.
 * Sources: Windows 11 design guidelines (rounded corners, Mica, soft shadow);
 * https://learn.microsoft.com/windows/apps/design/signature-experiences/geometry
 *
 * Returns a fresh theme object on each call so caller customizations never
 * leak between consumers.
 */
export function createRedmondTheme(options: RedmondThemeOptions = {}): OsTheme {
  const accent = options.accent ?? "#0078d4";
  return {
    id: "redmond",
    name: "Redmond",
    palette: {
      background: "#f3f3f3",
      surface: "rgba(243, 243, 243, 0.82)",
      textPrimary: "#1a1a1a",
      textSecondary: "rgba(0, 0, 0, 0.6)",
      accent,
      border: "rgba(0, 0, 0, 0.08)",
    },
    shape: {
      // Windows 11 rounds top-level windows at 8px and inner controls at 4px.
      windowRadius: 8,
      dockTileRadius: 8,
      small: 4,
    },
    motion: {
      windowOpenDurationMs: 150,
      windowOpenEasing: "cubic-bezier(0.1, 0.9, 0.2, 1)",
      dockHoverDurationMs: 120,
      // A Windows taskbar does not magnify on hover; turn the fisheye off.
      dockMagnification: 1,
      genieDurationMs: 200,
      genieEasing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
      missionControlDurationMs: 200,
      missionControlEasing: "cubic-bezier(0.32, 0.72, 0, 1)",
    },
    blur: {
      // Mica / Acrylic: a heavy backdrop blur with mild saturation.
      surface: "blur(30px) saturate(125%)",
      spotlight: "blur(30px) saturate(125%)",
    },
    elevation: {
      // Soft neutral shadows, lighter than the macOS glass float, suited to a
      // light surface where a heavy black shadow would read as muddy.
      windowFocused:
        "0 8px 24px -10px rgba(0,0,0,0.32), 0 2px 6px -2px rgba(0,0,0,0.18)",
      windowUnfocused: "0 4px 12px -8px rgba(0,0,0,0.20)",
    },
    wallpaper: {
      src: options.wallpaperSrc,
      // Windows does not shift the wallpaper on cursor move; keep it static.
      parallax: false,
      vignette: false,
    },
    chrome: {
      windowControls: "windows",
      dockPosition: "bottom",
      // A full-width taskbar flush to the bottom edge, not the floating pill.
      dockStyle: "bar",
      menuBar: "none",
      // The Windows Start menu, raised from the taskbar launcher.
      launcher: "menu",
    },
    customizable: {
      "palette.accent": {
        kind: "color-from-palette",
        section: "Appearance",
        label: "Accent",
        description: "Tints the dock tiles and the focused-window highlight.",
        options: ["#0078d4", "#005fb8", "#107c10", "#5c2d91", "#ca5010", "#e3008c"],
      },
      "shape.windowRadius": {
        kind: "range",
        section: "Appearance",
        label: "Window radius",
        min: 0,
        max: 12,
        step: 1,
        unit: "px",
      },
      "chrome.windowControls": {
        kind: "select",
        section: "Layout",
        label: "Window controls",
        options: [
          { value: "windows", label: "Windows" },
          { value: "traffic-lights", label: "macOS" },
          { value: "minimal", label: "Minimal" },
        ],
      },
      "chrome.dockPosition": {
        kind: "select",
        section: "Layout",
        label: "Dock position",
        options: [
          { value: "bottom", label: "Bottom" },
          { value: "left", label: "Left" },
          { value: "hidden", label: "Hidden" },
        ],
      },
      "chrome.dockStyle": {
        kind: "select",
        section: "Layout",
        label: "Dock style",
        description: "A flush taskbar or the floating macOS pill.",
        options: [
          { value: "bar", label: "Taskbar" },
          { value: "floating", label: "Floating" },
        ],
      },
      "chrome.dockAlign": {
        kind: "select",
        section: "Layout",
        label: "Taskbar alignment",
        description: "Center the icons (Windows 11) or pack them to the left (Windows 10).",
        options: [
          { value: "center", label: "Center" },
          { value: "start", label: "Left" },
        ],
      },
      "chrome.menuBar": {
        kind: "select",
        section: "Layout",
        label: "Menu bar",
        options: [
          { value: "none", label: "Hidden" },
          { value: "top", label: "Top" },
        ],
      },
      "motion.dockMagnification": {
        kind: "range",
        section: "Motion",
        label: "Dock magnification",
        description: "Peak size of the hovered dock icon. Set to 1 to turn the fisheye off.",
        min: 1,
        max: 2,
        step: 0.05,
        unit: "×",
      },
    },
  };
}

export type { OsTheme } from "@react-ui-os/core";
