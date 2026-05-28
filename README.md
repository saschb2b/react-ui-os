# react-ui-os

A React component library that gives you a working OS-style desktop in one line, themable in two.

```tsx
import { Desktop } from "@react-ui-os/desktop";
import { defaultTheme } from "@react-ui-os/theme-default";

const apps = [
  { id: "hello", name: "Hello", content: () => <h1>Hello, desktop.</h1> },
];

<Desktop apps={apps} theme={defaultTheme} />;
```

That single tag produces wallpaper, dock, draggable resizable windows with macOS-style traffic lights, focus tracking, a minimize-to-dock genie animation, and the wiring that lets the menu bar know which app is on top. Drop in a different theme and the whole desktop changes register. Hide the dock, move it to the side, swap traffic lights for Windows-style controls. The library knows about the metaphor; the theme dresses it.

## Status

Phase 1 scaffold. Window manager, basic desktop, default theme, playground demo. Phase 2 adds keyboard shortcuts, Spotlight, and the Settings app. Phase 3 ships the cinematic Mintables theme.

See [`CLAUDE.md`](./CLAUDE.md) for architecture and contribution rules. See [`DESIGN.md`](./DESIGN.md) for the visual direction and what each token is for.

## Why this exists

Most React UI libraries ship fifty components and let you wire them. That instinct produces tidy webapps. It does not produce a coherent OS feeling, because nobody wants to wire fifty pieces into a desktop and keep them consistent. This library inverts the contract. You register apps; the library composes the system. One object describing an app lights up the dock, the menu bar, Spotlight, and the keyboard shortcuts at once. Add an app to the registry and four surfaces update.

The skeleton is unbranded by default. Mintables-style frosted glass, light productivity surfaces, retro pixel-window chrome are all themes, not forks.

## Packages

| Package | Purpose |
| --- | --- |
| `@react-ui-os/core` | Pure logic. Window manager, app and theme types, storage adapter. No JSX. |
| `@react-ui-os/desktop` | The components. `<Desktop>`, `<DesktopProvider>`, `<Wallpaper>`, `<MenuBar>`, `<Dock>`, `<WindowLayer>`, `<Window>`. |
| `@react-ui-os/theme-default` | Unbranded baseline theme. |
| `@react-ui-os/theme-mintables` | (Phase 3) The cinematic frosted-glass theme. |

## Three depths of API

The library is designed so the easy thing is short, and the hard thing is reachable.

### 1. One-line desktop

```tsx
<Desktop apps={apps} theme={defaultTheme} />
```

Full stack. Wallpaper, menu bar, dock, windows, focus model. You opt out of pieces by switching to depth 2.

### 2. Composable provider

```tsx
<DesktopProvider apps={apps} theme={theme}>
  <Wallpaper />
  <MenuBar brand="acme" />
  <YourCustomThing />
  <WindowLayer />
  <Dock />
</DesktopProvider>
```

Same provider, but you choose which surfaces to render and add your own.

### 3. Hooks

```tsx
const { windows, focusedWindow, openWindow, minimizeWindow } = useWindowManager();
const theme = useTheme();
const apps = useApps();
```

When you need to drive the system from somewhere unusual. A custom dock, a launcher widget, a keyboard shortcut handler.

## App registration

Apps are data. Contributing one is one object.

```tsx
import type { App } from "@react-ui-os/core";

const notes: App = {
  id: "notes",
  name: "Notes",
  tagline: "Plain-text notes",
  accent: "#f59e0b",
  defaultBounds: { w: 520, h: 360 },
  content: ({ focused }) => <NotesEditor focused={focused} />,
};
```

The dock displays it. The menu bar says its name when focused. Spotlight finds it (phase 2). Keyboard shortcuts target it by registry index (phase 2). You did not wire any of that.

## Theming

Themes are token bags. Build-time selection. End users can tweak whatever the theme exposes as customizable through a Settings panel (phase 2).

```ts
import type { OsTheme } from "@react-ui-os/core";

export const myTheme: OsTheme = {
  id: "my-theme",
  name: "My Theme",
  palette: { /* … */ },
  shape: { windowRadius, dockTileRadius, small },
  motion: { /* durations and easings */ },
  blur: { surface, spotlight },
  wallpaper: { src: "/wallpaper.jpg", parallax: true, vignette: true },
  chrome: {
    windowControls: "traffic-lights" | "windows" | "minimal",
    dockPosition: "bottom" | "left" | "hidden",
    menuBar: "top" | "in-window" | "none",
  },
};
```

`chrome` is the lever that lets a SaaS dashboard hide the wallpaper and put the dock on the left, while a maker tool keeps the full macOS-style register. Same components, different stance.

## Storage

Library-owned. Defaults to `localStorage` with a custom-event change bus, so any subscriber updates without polling. Swap the backend for server-side persistence or cross-device sync by passing a `storage` adapter to `<Desktop>` or `<DesktopProvider>`.

```tsx
import { createLocalStorageAdapter } from "@react-ui-os/core";

<Desktop apps={apps} theme={theme} storage={myAdapter} />;
```

## Development

```bash
pnpm install
pnpm dev          # launches apps/playground at http://localhost:5173
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # vitest across all packages
pnpm build        # turbo build (no bundles yet, source-exported in phase 1)
pnpm lint
pnpm format
```

The repo is a `pnpm` + Turborepo monorepo. Packages export their TypeScript source directly during phase 1 (`"exports": "./src/index.ts"`); bundling will land closer to publishing.

## Layout

```
react-ui-os/
  apps/
    playground/                # Vite + React 19 demo
  packages/
    core/                      # @react-ui-os/core (window-manager, types, storage)
    desktop/                   # @react-ui-os/desktop (components)
    theme-default/             # @react-ui-os/theme-default
  CLAUDE.md                    # architecture and contribution rules
  DESIGN.md                    # visual direction and design tokens
```

## License

MIT.
