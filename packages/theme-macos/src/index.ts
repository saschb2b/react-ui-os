import type { OsTheme } from "@react-ui-os/core";

export interface MacosThemeOptions {
  /**
   * Accent override. Defaults to the macOS "Blue" control accent (#0a84ff).
   * Used as the system-wide accent fallback when no per-app accent is set.
   */
  accent?: string;
  /**
   * Wallpaper image url for the light appearance. Themes do not bundle assets;
   * the consumer supplies the path. When omitted, the palette background fills
   * the desktop and the theme reads as the bare skeleton.
   */
  wallpaperSrc?: string;
  /**
   * Wallpaper image url for the dark appearance. Defaults to `wallpaperSrc`
   * when omitted, so dark mode keeps the light wallpaper unless a darker one
   * is supplied.
   */
  darkWallpaperSrc?: string;
  /**
   * Wallpapers to offer in Settings > Appearance. When provided, the theme
   * exposes a `wallpaper.src` picker; choosing one overrides the appearance
   * default until reset. Themes don't bundle assets, so the consumer supplies
   * the list (the same paths it passes for `wallpaperSrc`).
   */
  wallpaperOptions?: { src: string; label: string }[];
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
  // macOS "Blue" accent, the default highlight color (System Settings >
  // Appearance). Apple ships it as the system control-accent blue.
  const accent = options.accent ?? "#0a84ff";
  return {
    id: "macos",
    name: "macOS",
    palette: {
      // Light appearance, matching the Tahoe Day wallpaper in the reference.
      // Surfaces are a light vibrancy material (translucent so the wallpaper
      // tints them through the blur); text is Apple's near-black label color.
      background: "#f4f5f7",
      surface: "rgba(246, 247, 249, 0.72)",
      textPrimary: "#1d1d1f",
      textSecondary: "rgba(0, 0, 0, 0.55)",
      accent,
      border: "rgba(0, 0, 0, 0.12)",
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
      // macOS's default minimize is the genie warp, which bends the window into
      // the dock and needs a GL displacement mesh, out of reach for CSS. We
      // render its other built-in option, the Scale Effect (a quick scale and
      // fade toward the dock tile), which our translate-and-scale genie matches.
      genieDurationMs: 280,
      genieEasing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
      missionControlDurationMs: 220,
      missionControlEasing: "cubic-bezier(0.32, 0.72, 0, 1)",
      // NSMenu fades in (rendered by the Window Server), no scale or slide. The
      // system fade is not publicly documented, so a short fade matching its
      // near-instant feel; the scale/offset defaults keep it a plain fade.
      contextMenuDurationMs: 120,
    },
    blur: {
      surface: "blur(20px) saturate(160%)",
      spotlight: "blur(28px) saturate(160%)",
    },
    elevation: {
      // Light appearance: macOS floats windows on a soft, wide shadow, far
      // lighter than a dark surface needs (a heavy black halo reads as muddy
      // over light vibrancy).
      windowFocused:
        "0 22px 48px -16px rgba(0,0,0,0.28), 0 6px 16px -8px rgba(0,0,0,0.18)",
      windowUnfocused: "0 10px 26px -14px rgba(0,0,0,0.18)",
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
      // The floating dock's resting tile; icons fill ~0.6 of it. The 24pt menu
      // bar is the Big Sur+ height.
      dockTileSize: 56,
      dockIconScale: 0.6,
      menuBarHeight: 24,
    },
    // Follow the OS color scheme by default; the user can force Light or Dark
    // from Settings > Appearance.
    appearance: "auto",
    appearances: {
      // Dark appearance: Apple's dark vibrancy. A near-black desktop, dark
      // translucent chrome, white label text, and the deeper shadow a dark
      // surface carries. The system-blue accent is inherited unchanged.
      dark: {
        palette: {
          background: "#1e2129",
          surface: "rgba(28, 30, 38, 0.78)",
          textPrimary: "#f1f3f8",
          textSecondary: "rgba(241, 243, 248, 0.62)",
          border: "rgba(255, 255, 255, 0.1)",
        },
        elevation: {
          windowFocused:
            "0 24px 54px -16px rgba(0,0,0,0.6), 0 8px 20px -8px rgba(0,0,0,0.4)",
          windowUnfocused: "0 12px 30px -16px rgba(0,0,0,0.5)",
        },
        ...(options.darkWallpaperSrc
          ? { wallpaper: { src: options.darkWallpaperSrc } }
          : {}),
      },
    },
    customizable: {
      appearance: {
        kind: "select",
        section: "Appearance",
        label: "Appearance",
        description: "Light, Dark, or follow the system setting.",
        options: [
          { value: "auto", label: "Auto" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ],
      },
      ...(options.wallpaperOptions
        ? {
            "wallpaper.src": {
              kind: "image-pick" as const,
              section: "Appearance",
              label: "Wallpaper",
              description: "Overrides the appearance default until reset.",
              options: options.wallpaperOptions,
            },
          }
        : {}),
      "palette.accent": {
        kind: "color-from-palette",
        section: "Appearance",
        label: "Accent color",
        description: "Tints the dock tile gradients and focused-window highlight.",
        // The macOS System Settings accent palette: Blue, Purple, Pink, Red,
        // Orange, Green.
        options: ["#0a84ff", "#8944ab", "#f74f9e", "#ff5257", "#f7821b", "#62ba46"],
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
