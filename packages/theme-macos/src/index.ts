import type { OsTheme } from "@react-ui-os/core";

export interface MacosThemeOptions {
  /**
   * Accent override. Defaults to the macOS-style blue (#6b8afd). Used as the
   * system-wide accent fallback when no per-app accent is set.
   */
  accent?: string;
  /**
   * Wallpaper image url. Themes do not bundle assets; the consumer supplies
   * the path. When omitted, the palette background fills the desktop and the
   * theme reads as the bare skeleton.
   */
  wallpaperSrc?: string;
}

/**
 * The macOS register: traffic lights, a floating dock with a fisheye, a
 * translucent top menu bar, soft motion. With no wallpaper it doubles as the
 * unbranded baseline ("the skeleton"), so consumers immediately see what is
 * theirs to customize; supply a wallpaper for the full Mac look.
 *
 * macOS has no cursor parallax and no wallpaper vignette, so both stay off
 * (see the "build on the shoulders of giants" note in CLAUDE.md).
 *
 * The `customizable` block declares which tokens end users may tweak from
 * the Settings panel. Returns a fresh object on each call so caller
 * customizations never leak between consumers.
 */
export function createMacosTheme(options: MacosThemeOptions = {}): OsTheme {
  const accent = options.accent ?? "#6b8afd";
  return {
    id: "macos",
    name: "macOS",
    palette: {
      background: "#1e2129",
      surface: "rgba(28, 30, 38, 0.78)",
      textPrimary: "#f1f3f8",
      textSecondary: "rgba(241, 243, 248, 0.65)",
      accent,
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
      // No wallpaper reads as the bare skeleton; supply one for the Mac look.
      src: options.wallpaperSrc,
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
}

/**
 * The macOS theme with no wallpaper: the unbranded baseline. Kept as a static
 * export so a consumer can drop in `<Desktop theme={macosTheme} />` without
 * the factory call. Supply a wallpaper with `createMacosTheme({ ... })`.
 */
export const macosTheme: OsTheme = createMacosTheme();

export type { OsTheme } from "@react-ui-os/core";
