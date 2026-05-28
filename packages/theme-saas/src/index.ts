import type { OsTheme } from "@react-ui-os/core";

export interface SaasThemeOptions {
  /**
   * Optional brand accent override. Defaults to a calm indigo. Used as
   * the system-wide accent fallback when no per-app accent is set.
   */
  accent?: string;
}

/**
 * Neutral light theme that exercises the chrome variants the Mac-style
 * defaults do not. The dock sits on the left edge (`chrome.dockPosition:
 * "left"`) and the menu bar is hidden (`chrome.menuBar: "none"`) so the
 * shell reads more like a focused workspace tool (Linear, Notion, Vercel
 * dashboard) than a desktop OS. Useful both as a starting point for a
 * SaaS-style product and as proof that the theme tokens are real.
 *
 * Returns a fresh theme object on each call so caller customizations
 * never leak between consumers.
 */
export function createSaasTheme(options: SaasThemeOptions = {}): OsTheme {
  const accent = options.accent ?? "#5b6cff";
  return {
    id: "saas",
    name: "SaaS",
    palette: {
      background: "#f5f6fa",
      surface: "rgba(255, 255, 255, 0.82)",
      textPrimary: "#0d1226",
      textSecondary: "rgba(13, 18, 38, 0.62)",
      accent,
      border: "rgba(13, 18, 38, 0.10)",
    },
    shape: {
      windowRadius: 10,
      dockTileRadius: 12,
      small: 6,
    },
    motion: {
      windowOpenDurationMs: 160,
      windowOpenEasing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
      dockHoverDurationMs: 120,
      genieDurationMs: 240,
      genieEasing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
    },
    blur: {
      surface: "blur(16px) saturate(140%)",
      spotlight: "blur(20px) saturate(150%)",
    },
    wallpaper: {
      src: undefined,
      parallax: false,
      vignette: false,
    },
    chrome: {
      windowControls: "traffic-lights",
      dockPosition: "left",
      menuBar: "none",
    },
    customizable: {
      "palette.accent": {
        kind: "color-from-palette",
        section: "Appearance",
        label: "Accent",
        description: "Tints the dock tiles and the focused-window highlight.",
        options: [
          "#5b6cff",
          "#22c55e",
          "#a855f7",
          "#0ea5e9",
          "#f59e0b",
          "#ec4899",
        ],
      },
      "shape.windowRadius": {
        kind: "range",
        section: "Appearance",
        label: "Window radius",
        min: 0,
        max: 20,
        step: 2,
        unit: "px",
      },
      "shape.dockTileRadius": {
        kind: "range",
        section: "Appearance",
        label: "Dock tile radius",
        min: 4,
        max: 20,
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
      "chrome.menuBar": {
        kind: "select",
        section: "Layout",
        label: "Menu bar",
        options: [
          { value: "none", label: "Hidden" },
          { value: "top", label: "Top" },
        ],
      },
    },
  };
}
