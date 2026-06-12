import type { OsTheme } from "@react-ui-os/core";

export interface WindowsThemeOptions {
  /**
   * Optional accent override. Defaults to the Windows 11 "Default blue"
   * (#0078d4). Used as the system-wide accent fallback when no per-app
   * accent is set.
   */
  accent?: string;
  /**
   * Wallpaper image url for the light appearance. Themes do not bundle assets;
   * the consumer supplies the path. When omitted, the desktop falls back to the
   * light palette background.
   */
  wallpaperSrc?: string;
  /**
   * Wallpaper image url for the dark appearance. Defaults to `wallpaperSrc`
   * when omitted.
   */
  darkWallpaperSrc?: string;
  /**
   * Wallpapers to offer in Settings > Appearance. When provided, the theme
   * exposes a `wallpaper.src` picker; choosing one overrides the appearance
   * default until reset.
   */
  wallpaperOptions?: { src: string; label: string }[];
}

/**
 * The Windows register. Where the default theme reads as macOS, this one
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
export function createWindowsTheme(options: WindowsThemeOptions = {}): OsTheme {
  const accent = options.accent ?? "#0078d4";
  return {
    id: "windows",
    name: "Windows",
    // Windows 11's UI font.
    font: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
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
      // Windows 11 Fluent menus (MenuFlyout) fade and slide in from a small
      // vertical offset (MenuPopupThemeTransition). Fluent's fast duration is
      // 167ms; the decelerate windowOpenEasing carries it.
      contextMenuDurationMs: 167,
      contextMenuTranslateY: 8,
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
      // The "Show desktop" sliver in the far bottom-right corner.
      showDesktopButton: true,
      // The Task View button beside Start, opening the windows overview.
      taskViewButton: true,
      // Right-click the empty taskbar for "Taskbar settings".
      taskbarContextMenu: true,
      // Windows 11 taskbar: 24px icons in a 40px button, a 48px-tall bar.
      dockTileSize: 40,
      dockIconScale: 0.6,
      // "Show smaller taskbar buttons" defaults to shrinking only when the
      // icon run would overflow the bar, the Windows default. "Always" gives
      // the compact 32px taskbar.
      // Source: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/
      dockSmallButtons: "when-full",
      // Combined, icon-only buttons, the Windows 11 default. "Never" shows
      // each running window as a separate labeled button.
      dockCombineButtons: "always",
      // Start menu personalization defaults, the May 2026 Insider controls
      // (Settings > Personalization > Start). Explicit so the Settings
      // toggles reflect the effective state.
      startMenuSize: "auto",
      startMenuPinned: true,
      startMenuRecent: true,
      startMenuRecentFiles: true,
      startMenuAllApps: true,
      startMenuProfile: true,
      // Apps that ship a Fluent icon variant use it here.
      iconStyle: "fluent",
    },
    // Follow the OS color scheme by default; switch in Settings > Appearance.
    appearance: "auto",
    appearances: {
      // Windows 11 dark Mica: near-black surfaces, white text, deeper shadows.
      // The #0078d4 accent is inherited unchanged.
      dark: {
        palette: {
          background: "#202020",
          surface: "rgba(43, 43, 43, 0.85)",
          textPrimary: "#ffffff",
          textSecondary: "rgba(255, 255, 255, 0.6)",
          border: "rgba(255, 255, 255, 0.09)",
        },
        elevation: {
          windowFocused:
            "0 10px 28px -10px rgba(0,0,0,0.55), 0 3px 8px -3px rgba(0,0,0,0.4)",
          windowUnfocused: "0 6px 16px -10px rgba(0,0,0,0.45)",
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
      // The Taskbar section mirrors Windows 11's Personalization > Taskbar page,
      // which the taskbar's right-click "Taskbar settings" opens directly: an
      // alignment control over a list of taskbar-item toggles.
      "chrome.dockAlign": {
        kind: "select",
        section: "Taskbar",
        label: "Taskbar alignment",
        description:
          "Center the icons (Windows 11) or pack them to the start of the bar: left on a horizontal taskbar, top on a vertical one (Windows 10).",
        options: [
          { value: "center", label: "Center" },
          { value: "start", label: "Left" },
        ],
      },
      "chrome.taskViewButton": {
        kind: "toggle",
        section: "Taskbar",
        label: "Task view",
        description: "Show the Task View button that opens the windows overview.",
      },
      "chrome.showDesktopButton": {
        kind: "toggle",
        section: "Taskbar",
        label: "Show desktop",
        description: "Select the far corner of the taskbar to show the desktop.",
      },
      // All four edges, the May 2026 Insider "taskbar position" control. Order
      // follows the classic "Taskbar location on screen" dropdown. Hiding the
      // bar is its own toggle below ("Automatically hide the taskbar"), as on
      // Windows.
      // Source: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/
      "chrome.dockPosition": {
        kind: "select",
        section: "Taskbar",
        label: "Taskbar position",
        description: "Dock the taskbar to any edge of the screen.",
        options: [
          { value: "left", label: "Left" },
          { value: "top", label: "Top" },
          { value: "right", label: "Right" },
          { value: "bottom", label: "Bottom" },
        ],
      },
      "chrome.dockStyle": {
        kind: "select",
        section: "Taskbar",
        label: "Taskbar style",
        description: "A flush taskbar or the floating macOS pill.",
        options: [
          { value: "bar", label: "Taskbar" },
          { value: "floating", label: "Floating" },
        ],
      },
      "chrome.dockSmallButtons": {
        kind: "select",
        section: "Taskbar",
        label: "Show smaller taskbar buttons",
        description:
          "Smaller icons and a shorter taskbar, for more vertical space for your apps.",
        options: [
          { value: "when-full", label: "When taskbar is full" },
          { value: "always", label: "Always" },
          { value: "never", label: "Never" },
        ],
      },
      "chrome.dockCombineButtons": {
        kind: "select",
        section: "Taskbar",
        label: "Combine taskbar buttons and hide labels",
        description:
          "With Never, each open window appears as a separate labeled button; a vertical taskbar widens to fit them.",
        options: [
          { value: "always", label: "Always" },
          { value: "when-full", label: "When taskbar is full" },
          { value: "never", label: "Never" },
        ],
      },
      "chrome.dockAutoHide": {
        kind: "toggle",
        section: "Taskbar",
        label: "Automatically hide the taskbar",
        description: "Slide the taskbar away until you point at the screen edge.",
      },
      // The Start section mirrors Settings > Personalization > Start as
      // announced in the May 2026 Insider post: a size choice, independent
      // section toggles, the separate file control, and the profile privacy
      // option.
      // Source: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/
      "chrome.startMenuSize": {
        kind: "select",
        section: "Start",
        label: "Start menu size",
        description: "Automatic, the small 6-column grid, or the large 8-column one.",
        options: [
          { value: "auto", label: "Automatic" },
          { value: "small", label: "Small" },
          { value: "large", label: "Large" },
        ],
      },
      "chrome.startMenuPinned": {
        kind: "toggle",
        section: "Start",
        label: "Show Pinned section",
        description: "With Pinned off, Start opens the All apps list.",
      },
      "chrome.startMenuRecent": {
        kind: "toggle",
        section: "Start",
        label: "Show Recent section",
        description: "Recently used apps and files.",
      },
      "chrome.startMenuRecentFiles": {
        kind: "toggle",
        section: "Start",
        label: "Show recently used files in Start",
        description: "Turn off file suggestions without hiding recently used apps.",
      },
      "chrome.startMenuAllApps": {
        kind: "toggle",
        section: "Start",
        label: "Show All apps list",
      },
      "chrome.startMenuProfile": {
        kind: "toggle",
        section: "Start",
        label: "Show my name and profile picture in Start",
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
        description:
          "Peak size of the hovered dock icon. Set to 1 to turn the fisheye off.",
        min: 1,
        max: 2,
        step: 0.05,
        unit: "×",
      },
    },
  };
}

export type { OsTheme } from "@react-ui-os/core";
