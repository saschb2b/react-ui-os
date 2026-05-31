import type { OsTheme } from "@react-ui-os/core";

/**
 * Unbranded baseline theme. Looks like a stock OS without a personal
 * wallpaper or accent: neutral surfaces, a modest accent, soft motion. The
 * point is to read as "the skeleton" so consumers immediately see what is
 * theirs to customize. Branded looks ship as separate theme packages.
 *
 * The `customizable` block declares which tokens end users may tweak from
 * the Settings panel. Themes can expose more or less; this baseline picks
 * a small, demonstrative set.
 */
export const defaultTheme: OsTheme = {
  id: "default",
  name: "Default",
  palette: {
    background: "#1e2129",
    surface: "rgba(28, 30, 38, 0.78)",
    textPrimary: "#f1f3f8",
    textSecondary: "rgba(241, 243, 248, 0.65)",
    accent: "#6b8afd",
    border: "rgba(255, 255, 255, 0.10)",
  },
  shape: {
    windowRadius: 12,
    dockTileRadius: 14,
    small: 6,
  },
  motion: {
    windowOpenDurationMs: 180,
    windowOpenEasing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
    dockHoverDurationMs: 140,
    dockMagnification: 1.5,
    genieDurationMs: 280,
    genieEasing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
    missionControlDurationMs: 220,
    missionControlEasing: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  blur: {
    surface: "blur(20px) saturate(160%)",
    spotlight: "blur(28px) saturate(160%)",
  },
  elevation: {
    windowFocused:
      "0 20px 50px -12px rgba(0,0,0,0.55), 0 8px 18px -6px rgba(0,0,0,0.35)",
    windowUnfocused: "0 10px 24px -8px rgba(0,0,0,0.4)",
  },
  wallpaper: {
    // Unbranded baseline ships no wallpaper image. The palette background
    // fills the desktop. A theme like theme-mintables can supply one.
    src: undefined,
    parallax: false,
    vignette: false,
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
      label: "Accent color",
      description: "Tints the dock tile gradients and focused-window highlight.",
      options: ["#6b8afd", "#f59e0b", "#22c55e", "#a855f7", "#ec4899", "#06b6d4"],
    },
    "shape.windowRadius": {
      kind: "range",
      section: "Appearance",
      label: "Window radius",
      description: "Corner roundness of every window.",
      min: 0,
      max: 24,
      step: 2,
      unit: "px",
    },
    "shape.dockTileRadius": {
      kind: "range",
      section: "Appearance",
      label: "Dock tile radius",
      min: 4,
      max: 24,
      step: 2,
      unit: "px",
    },
    "motion.windowOpenDurationMs": {
      kind: "range",
      section: "Motion",
      label: "Window open speed",
      description: "How long the window open animation plays.",
      min: 0,
      max: 400,
      step: 20,
      unit: "ms",
    },
    "motion.genieDurationMs": {
      kind: "range",
      section: "Motion",
      label: "Minimize speed",
      description: "Genie animation duration on minimize.",
      min: 0,
      max: 600,
      step: 20,
      unit: "ms",
    },
    "motion.missionControlDurationMs": {
      kind: "range",
      section: "Motion",
      label: "Mission Control speed",
      description: "How long the Mission Control spread and collapse plays.",
      min: 0,
      max: 500,
      step: 20,
      unit: "ms",
    },
    "motion.dockMagnification": {
      kind: "range",
      section: "Motion",
      label: "Dock magnification",
      description:
        "Peak size of the hovered dock icon. Set to 1 to turn the fisheye off.",
      min: 1,
      max: 2,
      step: 0.05,
      unit: "×",
    },
    "chrome.dockPosition": {
      kind: "select",
      section: "Layout",
      label: "Dock position",
      description: "Where the app dock sits on the desktop.",
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
      description: "Style of the close, minimize, and maximize buttons.",
      options: [
        { value: "traffic-lights", label: "macOS" },
        { value: "windows", label: "Windows" },
        { value: "minimal", label: "Minimal" },
      ],
    },
    "wallpaper.vignette": {
      kind: "toggle",
      section: "Appearance",
      label: "Wallpaper vignette",
      description: "Adds a soft dark halo around the wallpaper edges.",
    },
  },
};

export type { OsTheme } from "@react-ui-os/core";
