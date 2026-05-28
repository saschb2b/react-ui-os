"use client";

import type { ReactNode } from "react";
import type { App, OsTheme, StorageAdapter } from "@react-ui-os/core";
import { WindowManagerProvider } from "@react-ui-os/core";
import { DesktopContextProvider } from "./desktop-context";
import { StyleInjector } from "./style-injector";

export interface DesktopProviderProps {
  apps: App[];
  theme: OsTheme;
  /** Optional storage backend override. Defaults to localStorage. */
  storage?: StorageAdapter;
  children: ReactNode;
}

/**
 * Lift-the-hood mode. Wrap your own composition of `<Wallpaper>`,
 * `<MenuBar>`, `<Dock>`, `<WindowLayer>`, and `<Spotlight>`. Use
 * `<Desktop>` instead for the one-line entry point.
 */
export function DesktopProvider({
  apps,
  theme,
  storage,
  children,
}: DesktopProviderProps) {
  return (
    <DesktopContextProvider apps={apps} theme={theme} storage={storage}>
      <WindowManagerProvider>
        <StyleInjector />
        {children}
      </WindowManagerProvider>
    </DesktopContextProvider>
  );
}
