export { Desktop } from "./Desktop";
export type { DesktopProps } from "./Desktop";
export { DesktopProvider } from "./DesktopProvider";
export type { DesktopProviderProps } from "./DesktopProvider";
export { Wallpaper } from "./Wallpaper";
export { MenuBar, MENU_BAR_HEIGHT } from "./MenuBar";
export { Dock, DOCK_HEIGHT, getDockTileRect } from "./Dock";
export { WindowLayer } from "./WindowLayer";
export { Window } from "./Window";
export {
  useDesktopContext,
  useTheme,
  useApps,
  useApp,
} from "./desktop-context";
