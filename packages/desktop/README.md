# @react-ui-os/desktop

The react-ui-os components. One tag renders a working desktop: wallpaper,
menu bar, dock, draggable windows, launcher, settings, notifications.

```tsx
import type { App } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import { macosTheme } from "@react-ui-os/theme-macos";

const apps: App[] = [
  { id: "notes", name: "Notes", content: () => <p>Hello, desktop.</p> },
];

export default function App() {
  return <Desktop apps={apps} theme={macosTheme} />;
}
```

No CSS file to import; the desktop injects its own keyframes and reads every
color, radius, duration, and blur from the active theme's tokens. The bundle
ships its `"use client"` directive, so it imports directly in Next.js App
Router and other React Server Components setups.

## Three depths of API

1. `<Desktop apps theme>`: the full default composition.
2. `<DesktopProvider>` plus your own pick of `<Wallpaper>`, `<MenuBar>`,
   `<Dock>`, `<WindowLayer>`, `<Launcher>`, `<Settings>`.
3. `useWindowManager()`, `useTheme()`, `useApps()`, `useSettings()`: drive the
   system from outside the default chrome.

Each level steps down to the next without rewriting; everything the default
composition mounts is exported from the package root.

## Extending the system

- An `App` object lights up the dock, menu bar, launcher, and keyboard
  shortcuts at once.
- `registerSystemWindow(id, def)` adds a system window plus an optional
  desktop shortcut.
- `registerSpotlightSource(id, query => results)` adds rows to the Cmd-K
  palette.
- `registerStatusItem(...)`, `registerQuickSetting(...)`, and
  `registerRecentsSource(...)` contribute to the menu-bar tray, the system
  popover, and the Start menu's Recent section.

## Peer dependencies

`react`, `react-dom`, and `@react-ui-os/core`. Core is a peer rather than a
regular dependency because its window-manager context and imperative stores
must be the same instance your own imports resolve to.

Docs: https://saschb2b.github.io/react-ui-os
