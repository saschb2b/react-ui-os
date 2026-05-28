import type { OsTheme } from "@react-ui-os/core";

/**
 * Unbranded baseline theme. Looks like a stock OS without a personal
 * wallpaper or accent: neutral surfaces, a modest accent, soft motion. The
 * point is to read as "the skeleton" so consumers immediately see what is
 * theirs to customize. Branded looks ship as separate theme packages.
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
    genieDurationMs: 280,
    genieEasing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
  },
  blur: {
    surface: "blur(20px) saturate(160%)",
    spotlight: "blur(28px) saturate(160%)",
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
};

export type { OsTheme } from "@react-ui-os/core";
