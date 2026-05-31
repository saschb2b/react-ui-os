export { Desktop } from "./Desktop";
export type { DesktopProps } from "./Desktop";
export { DesktopProvider } from "./DesktopProvider";
export type { DesktopProviderProps } from "./DesktopProvider";
export { Wallpaper } from "./Wallpaper";
export { MenuBar, MENU_BAR_HEIGHT } from "./MenuBar";
export { Dock, DOCK_HEIGHT, DOCK_WIDTH, getDockTileRect } from "./Dock";
export { WindowLayer } from "./WindowLayer";
export { Window } from "./Window";
export { Spotlight } from "./Spotlight";
export { KeyboardShortcuts } from "./keyboard-shortcuts";
export { NotificationToasts } from "./NotificationToasts";
export { NotificationCenter } from "./NotificationCenter";
export { QuickSettings } from "./QuickSettings";
export {
  registerQuickSetting,
  unregisterQuickSetting,
  listQuickSettings,
  subscribeQuickSettings,
  type QuickSettingItem,
  type QuickSettingToggle,
  type QuickSettingSlider,
  type QuickSettingAction,
} from "./quick-settings";
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
export { Tooltip } from "./tooltip";
export { Slider, Toggle } from "./primitives";
export {
  registerStatusItem,
  unregisterStatusItem,
  listStatusItems,
  subscribeStatusItems,
  type StatusItem,
} from "./status-items";
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
  setSnapPreview,
  getSnapPreview,
  subscribeSnapPreview,
  computeSnapZone,
  rectForZone,
  type SnapZone,
  type SnapRect,
  type SnapState,
} from "./snap";
export {
  SPOTLIGHT_OPEN_EVENT,
  NOTIFICATION_CENTER_TOGGLE_EVENT,
  QUICK_SETTINGS_TOGGLE_EVENT,
} from "./events";
export {
  registerSpotlightSource,
  listSpotlightSources,
  subscribeSpotlightSources,
} from "./spotlight-sources";
export type { SpotlightSource, SpotlightResult } from "./spotlight-sources";
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
// Canonical "where should a new window open" helper. Every built-in surface
// (Dock, Spotlight, keyboard shortcuts) passes its result as the second arg to
// openWindow so the window is centered and clamped to the work area. Consumers
// that open windows programmatically should do the same; calling openWindow
// without bounds falls back to a fixed default that can overflow small
// viewports (a docs iframe, a phone).
export { pickInitialBounds, nextCascadeIndex } from "./util/initial-bounds";
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
