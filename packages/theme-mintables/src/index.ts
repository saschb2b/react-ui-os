import type { OsTheme } from "@react-ui-os/core";

export interface MintablesThemeOptions {
  /**
   * URL of the wallpaper image. Themes do not bundle assets; the consumer
   * supplies the path. When omitted, the desktop falls back to the dark
   * palette background and the parallax / vignette layers stay inert.
   */
  wallpaperSrc?: string;
  /**
   * Optional brand accent override. Defaults to the Mintables teal. Used
   * as the system-wide accent fallback when no per-app accent is set.
   */
  accent?: string;
}

/**
 * Cinematic frosted-glass theme. Dark palette with high blur, a teal
 * accent, parallax + vignette wallpaper, and full macOS-style chrome.
 * Designed for maker / personal-tool products where the first paint
 * should land like a desktop, not a webpage.
 *
 * Returns a fresh theme object on each call so caller customizations
 * never leak between consumers.
 */
export function createMintablesTheme(options: MintablesThemeOptions = {}): OsTheme {
  const accent = options.accent ?? "#5cb6b9";
  return {
    id: "mintables",
    name: "Mintables",
    palette: {
      background: "#0a0c1a",
      surface: "rgba(20, 22, 32, 0.62)",
      textPrimary: "#f1f3f8",
      textSecondary: "rgba(241, 243, 248, 0.7)",
      accent,
      border: "rgba(255, 255, 255, 0.08)",
    },
    shape: {
      windowRadius: 14,
      dockTileRadius: 16,
      small: 6,
    },
    motion: {
      windowOpenDurationMs: 220,
      windowOpenEasing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
      dockHoverDurationMs: 160,
      genieDurationMs: 320,
      genieEasing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
      missionControlDurationMs: 260,
      missionControlEasing: "cubic-bezier(0.32, 0.72, 0, 1)",
    },
    blur: {
      surface: "blur(28px) saturate(170%)",
      spotlight: "blur(32px) saturate(180%)",
    },
    wallpaper: {
      src: options.wallpaperSrc,
      parallax: true,
      vignette: true,
    },
    chrome: {
      windowControls: "traffic-lights",
      dockPosition: "bottom",
      menuBar: "top",
    },
    customizable: {
      "palette.accent": {
        kind: "color-from-palette",
        section: "Appearance",
        label: "Accent",
        description:
          "Tints the dock tiles, focused-window highlight, and Settings field UI.",
        options: ["#5cb6b9", "#7c66f5", "#a855f7", "#ec4899", "#f59e0b", "#22c55e"],
      },
      "wallpaper.parallax": {
        kind: "toggle",
        section: "Appearance",
        label: "Wallpaper parallax",
        description: "Cursor-driven shift on the wallpaper layer.",
      },
      "wallpaper.vignette": {
        kind: "toggle",
        section: "Appearance",
        label: "Wallpaper vignette",
      },
      "shape.windowRadius": {
        kind: "range",
        section: "Appearance",
        label: "Window radius",
        min: 0,
        max: 24,
        step: 2,
        unit: "px",
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
      "motion.genieDurationMs": {
        kind: "range",
        section: "Motion",
        label: "Minimize speed",
        min: 0,
        max: 600,
        step: 20,
        unit: "ms",
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
      "chrome.windowControls": {
        kind: "select",
        section: "Layout",
        label: "Window controls",
        options: [
          { value: "traffic-lights", label: "macOS" },
          { value: "windows", label: "Windows" },
          { value: "minimal", label: "Minimal" },
        ],
      },
    },
  };
}
