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
export { NotificationToasts } from "./NotificationToasts";
export { NotificationCenter } from "./NotificationCenter";
export { AppSwitcher } from "./AppSwitcher";
export { MissionControl } from "./MissionControl";
export {
  HudOverlay,
  showHud,
  hideHud,
  getHud,
  subscribeHud,
  type HudPayload,
} from "./hud";
export {
  ContextMenu,
  ContextMenuAnchor,
  openContextMenu,
  closeContextMenu,
  getContextMenuState,
  subscribeContextMenu,
  type ContextMenuItem,
  type ContextMenuState,
} from "./context-menu";
export { DesktopBackdrop } from "./desktop-backdrop";
export {
  SnapPreview,
  computeSnapZone,
  rectForZone,
  type SnapZone,
  type SnapRect,
  type SnapState,
} from "./snap";
export {
  SPOTLIGHT_OPEN_EVENT,
  NOTIFICATION_CENTER_TOGGLE_EVENT,
} from "./events";
export {
  registerSpotlightSource,
  listSpotlightSources,
  subscribeSpotlightSources,
} from "./spotlight-sources";
export type {
  SpotlightSource,
  SpotlightResult,
} from "./spotlight-sources";
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
