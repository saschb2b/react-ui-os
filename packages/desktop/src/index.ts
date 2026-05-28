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
export { FileExplorer } from "./FileExplorer";
export type {
  ExplorerItem,
  ExplorerAction,
  ExplorerSidebarItem,
  ExplorerSidebarSection,
  FileExplorerProps,
} from "./FileExplorer";
export { DesktopIcons } from "./DesktopIcons";
export { FolderSvg } from "./folder-svg";
export {
  systemWindows,
  getSystemWindow,
  listSystemWindows,
  registerSystemWindow,
  resolveSystemWindowName,
  type SystemWindowDef,
  type SystemWindowContentProps,
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
