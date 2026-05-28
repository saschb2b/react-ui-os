"use client";

import type { App, OsTheme, StorageAdapter } from "@react-ui-os/core";
import { DesktopProvider } from "./DesktopProvider";
import { Wallpaper } from "./Wallpaper";
import { MenuBar } from "./MenuBar";
import { Dock } from "./Dock";
import { WindowLayer } from "./WindowLayer";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { Spotlight } from "./Spotlight";

export interface DesktopProps {
  apps: App[];
  theme: OsTheme;
  /** Optional brand label shown in the menu bar. */
  brand?: string;
  /** Optional storage backend override. Defaults to localStorage. */
  storage?: StorageAdapter;
}

/**
 * One-line desktop. Wraps the provider stack and composes the default
 * surfaces: wallpaper, menu bar, dock, window layer, keyboard shortcuts,
 * and Spotlight. Replace with `<DesktopProvider>` + your own layout when
 * you need finer control.
 */
export function Desktop({ apps, theme, brand, storage }: DesktopProps) {
  return (
    <DesktopProvider apps={apps} theme={theme} storage={storage}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <Wallpaper />
        <MenuBar brand={brand} />
        <WindowLayer />
        <Dock />
        <KeyboardShortcuts />
        <Spotlight />
      </div>
    </DesktopProvider>
  );
}
