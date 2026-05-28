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

That single tag produces wallpaper, dock, draggable resizable windows with macOS-style traffic lights, focus tracking, a minimize-to-dock genie animation, Spotlight (Cmd-K), Settings (Cmd-,), and the wiring that lets the menu bar know which app is on top. Drop in a different theme and the whole desktop changes register. Hide the dock, move it to the side, swap traffic lights for Windows-style controls. The library knows about the metaphor; the theme dresses it.

**Read the [docs](https://saschb2b.github.io/react-ui-os/)** for the full component reference, or **open the [playground](https://saschb2b.github.io/react-ui-os/playground)** to try it inline.

## Why this exists

Most React UI libraries ship fifty components and let you wire them. That instinct produces tidy webapps. It does not produce a coherent OS feeling, because nobody wants to wire fifty pieces into a desktop and keep them consistent. **This library inverts the contract.** You register apps; the library composes the system. One object describing an app lights up the dock, the menu bar, Spotlight, and the keyboard shortcuts at once.

## Packages

| Package | Purpose |
| --- | --- |
| `@react-ui-os/core` | Pure logic. Window manager, app and theme types, storage adapter. No JSX. |
| `@react-ui-os/desktop` | The components. `<Desktop>`, `<DesktopProvider>`, `<Wallpaper>`, `<MenuBar>`, `<Dock>`, `<WindowLayer>`, `<Window>`, `<Spotlight>`, `<Settings>`, `<FileExplorer>`, `<DesktopIcons>`. |
| `@react-ui-os/theme-default` | Unbranded baseline theme. |
| `@react-ui-os/theme-mintables` | Cinematic frosted-glass theme with parallax wallpaper, deep blur, teal accent. |
| `@react-ui-os/theme-saas` | Neutral light theme. Left dock, hidden menu bar — exercises the non-Mac chrome variants. |

All five packages ship dual ESM/CJS bundles + TypeScript declarations via `tsup`. Source-exported during in-repo development via a `source` Vite condition; consumers resolve through the bundled `dist/` output.

## Three depths of API

The library is designed so the easy thing is short and the hard thing is reachable.

```tsx
// 1. One-line desktop — full default composition.
<Desktop apps={apps} theme={defaultTheme} />

// 2. Composable provider — pick which surfaces to render.
<DesktopProvider apps={apps} theme={theme}>
  <Wallpaper />
  <MenuBar brand="acme" />
  <YourCustomThing />
  <WindowLayer />
  <Dock />
  <Spotlight />
</DesktopProvider>

// 3. Hooks — drive the system from anywhere.
const { windows, focusedWindow, openWindow } = useWindowManager();
const theme = useTheme();
const { schema, prefs, setPref } = useSettings();
```

## App registration

Apps are data. Contributing one is one object that lights up four surfaces.

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

The dock displays it. The menu bar says its name when focused. Spotlight finds it by name. Keyboard shortcuts (`Cmd-N`) target it by registry index.

## Theming

Build-time selection. End users can tweak whatever the theme exposes as `customizable` through the Settings panel.

```ts
import type { OsTheme } from "@react-ui-os/core";

export const myTheme: OsTheme = {
  id: "my-theme",
  name: "My Theme",
  palette: { background, surface, textPrimary, textSecondary, accent, border },
  shape: { windowRadius, dockTileRadius, small },
  motion: { windowOpenDurationMs, windowOpenEasing, dockHoverDurationMs, genieDurationMs, genieEasing },
  blur: { surface, spotlight },
  wallpaper: { src: "/wallpaper.jpg", parallax: true, vignette: true },
  chrome: {
    windowControls: "traffic-lights" | "windows" | "minimal",
    dockPosition: "bottom" | "left" | "hidden",
    menuBar: "top" | "in-window" | "none",
  },
  customizable: { /* dotted-path field schema, optional */ },
};
```

`chrome` is the lever that lets a SaaS dashboard hide the wallpaper and put the dock on the left, while a maker tool keeps the full macOS register. Same components, different stance.

## Storage

Library-owned, swappable. Defaults to `localStorage` with a custom-event change bus. Pass your own adapter for server-backed persistence or cross-device sync.

```tsx
import { createLocalStorageAdapter } from "@react-ui-os/core";

<Desktop apps={apps} theme={theme} storage={myAdapter} />;
```

## Development

```bash
pnpm install
pnpm dev                       # apps/playground at http://localhost:5173
pnpm --filter docs dev         # apps/docs (Starlight) at http://localhost:4321
pnpm typecheck                 # tsc across all packages
pnpm test                      # vitest across all packages
pnpm build                     # turbo build (produces dist/ for each package)
```

The repo is a `pnpm` + Turborepo monorepo. CI runs typecheck + test + build on every push (`.github/workflows/ci.yml`); the docs deploy to GitHub Pages from `main` (`.github/workflows/docs.yml`).

## Layout

```
react-ui-os/
  apps/
    docs/                        # Astro Starlight docs site → react-ui-os.dev
    playground/                  # Vite + React 19 dev playground
  packages/
    core/                        # @react-ui-os/core (window-manager, types, storage)
    desktop/                     # @react-ui-os/desktop (components)
    theme-default/               # @react-ui-os/theme-default
    theme-mintables/             # @react-ui-os/theme-mintables
    theme-saas/                  # @react-ui-os/theme-saas
  .github/workflows/             # CI + Pages deploy
  CLAUDE.md                      # architecture and contribution rules
  DESIGN.md                      # visual direction and design tokens
```

## Support

- [Sponsor on Buy Me a Coffee](https://buymeacoffee.com/qohreuukw) keeps the lights on.
- [Open an issue](https://github.com/saschb2b/react-ui-os/issues) for bugs and feature requests.

## License

MIT. See [LICENSE](./LICENSE).
