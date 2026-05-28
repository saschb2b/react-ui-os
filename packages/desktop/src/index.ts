export { Desktop } from "./Desktop";
export type { DesktopProps } from "./Desktop";
export { DesktopProvider } from "./DesktopProvider";
export type { DesktopProviderProps } from "./DesktopProvider";
export { Wallpaper } from "./Wallpaper";
export { MenuBar, MENU_BAR_HEIGHT } from "./MenuBar";
export { Dock, DOCK_HEIGHT, getDockTileRect } from "./Dock";
export { WindowLayer } from "./WindowLayer";
export { Window } from "./Window";
export { Spotlight } from "./Spotlight";
export { KeyboardShortcuts } from "./keyboard-shortcuts";
export { SPOTLIGHT_OPEN_EVENT } from "./events";
export { Settings } from "./Settings";
export {
  systemWindows,
  getSystemWindow,
  listSystemWindows,
  type SystemWindowDef,
} from "./system-windows";
export {
  useDesktopContext,
  useTheme,
  useBaseTheme,
  useApps,
  useApp,
  useSettings,
  type UseSettingsResult,
} from "./desktop-context";
