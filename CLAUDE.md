# react-ui-os

A React component library that ships a working OS-style desktop. Apps are data; themes are token bags; the library does the composition. This document is the architecture reference for anyone (human or AI agent) extending the library.

## Tech stack

- **TypeScript strict, ESM only.** No CJS exports.
- **React 19** peer dependency.
- **Vite 7** for the playground app.
- **Vitest 3** for unit tests (window-manager reducer is pure, easy to cover).
- **pnpm workspaces + Turborepo** for monorepo orchestration.
- **ESLint + Prettier** for linting and formatting. No Biome.
- **No CSS framework.** Phase 1 uses inline styles consumed from theme tokens. CSS variables come in phase 2.

## Commands (from repo root)

- `pnpm dev` - launches `apps/playground` at `http://localhost:5173`
- `pnpm build` - turbo build pipeline (source-exported in phase 1, bundling later)
- `pnpm typecheck` - `tsc --noEmit` across all packages
- `pnpm test` - vitest across all packages
- `pnpm lint`
- `pnpm format:check` / `pnpm format`

## Repo layout

```
apps/
  playground/                   # Vite demo, the place to prove API decisions
packages/
  core/                         # @react-ui-os/core
    src/
      types.ts                  # App, OsTheme, AppContentProps
      window-manager/           # reducer + context + hooks
      storage/                  # StorageAdapter + localStorage default
      index.ts                  # public barrel
    tests/
  desktop/                      # @react-ui-os/desktop
    src/
      Desktop.tsx               # one-line API
      DesktopProvider.tsx       # lift-the-hood mode
      Wallpaper.tsx
      MenuBar.tsx
      Dock.tsx
      WindowLayer.tsx
      Window.tsx                # one window: chrome, drag, focus
      desktop-context.tsx       # apps + theme + storage context
      style-injector.tsx        # one-shot global keyframes
      util/
      index.ts
  theme-default/                # @react-ui-os/theme-default
    src/
      index.ts                  # exports `defaultTheme`
```

## The contract

Every concept in the library is one of three shapes.

### `App`

```ts
interface App {
  id: string;
  name: string;
  tagline?: string;
  accent?: string;
  icon?: ComponentType<{ size?: number }>;
  iconArt?: ComponentType<{ size?: number }>;
  defaultBounds?: { w: number; h: number };
  content: ComponentType<AppContentProps>;
}
```

One object. The dock, menu bar, Spotlight (phase 2), and keyboard shortcuts (phase 2) all read from the same `App[]` registry. Contributing here lights up four surfaces with no wiring.

### `OsTheme`

```ts
interface OsTheme {
  id: string;
  name: string;
  palette: { background, surface, textPrimary, textSecondary, accent, border };
  shape: { windowRadius, dockTileRadius, small };
  motion: { windowOpenDurationMs, windowOpenEasing, dockHoverDurationMs, genieDurationMs, genieEasing };
  blur: { surface, spotlight };
  wallpaper: { src?, parallax?, vignette? };
  chrome: { windowControls, dockPosition, menuBar };
}
```

Themes are pure data. They never depend on `@react-ui-os/desktop`; they live in their own package and only depend on `@react-ui-os/core` for types. This keeps the dependency graph clean and lets a consumer install a theme without pulling in the components.

`chrome` is the lever for the structural variants: SaaS-style dock-on-left, retro Windows controls, dock hidden entirely, etc. Visual tokens (`palette`, `shape`, `motion`, `blur`, `wallpaper`) handle everything else.

### `StorageAdapter`

```ts
interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  subscribe(listener: (key: string) => void): () => void;
}
```

Library-owned persistence with a swap. Default is `localStorage` + a custom-event change bus so listeners react without polling. Override via `<Desktop storage={myAdapter}>` to push to a backend or sync across devices.

## Package boundaries

- `core` is **pure logic + types**. No JSX outside the window-manager context provider. Never imports `@react-ui-os/desktop`.
- `desktop` is **components only**. Depends on `core` for types, hooks, and the WindowManagerProvider. Never imports a specific theme.
- Themes depend on `core` for types only.

Violations are a signal. If a component needs a token your theme does not have, the token is missing from the contract, not from the theme.

## Three depths of API

The same primitives are reachable at three levels. The library should always let users step down to the next level without rewriting.

1. **`<Desktop apps theme>`.** One tag. Full default composition.
2. **`<DesktopProvider apps theme>` + composed surfaces.** Wrap your own choice of `<Wallpaper>`, `<MenuBar>`, `<Dock>`, `<WindowLayer>`, `<Spotlight>` (phase 2), etc.
3. **`useWindowManager()`, `useTheme()`, `useApps()`, `useApp(id)`.** When you need to drive the system from somewhere outside the default chrome.

Designs that require depth-3 features for ordinary use cases are a smell. The 80% case should be depth 1.

## Lessons from Mintables baked into this library

These are the patterns the system enforces structurally, not just by convention. If you find yourself fighting them, ask whether the fight is justified before adding a workaround.

### Windows are first-class. URLs are downstream.

The window manager is the source of truth, held in React state. Routes (in any consuming app) are observers. Opening the same `App` twice focuses the existing window rather than spawning a duplicate. The stable id comes from the payload: `app:<id>` for app windows, `system:<id>` for built-in system windows like Settings.

If a consumer wants URL sync, they read `focusedWindow` and write to the router. The library does not own the URL.

### Drag is a layout property, not a state update.

`<Window>` writes `transform` directly to the DOM during a drag. React only learns the result on `pointerup`. This keeps multi-window scenes with heavy content (3D previews, editors) at 60 fps. When implementing resize handles, follow the same pattern: ref + direct DOM mutation during the gesture, commit on release.

### Animations are state machines, not effects.

Window open / close / minimize use a local `phase` state machine (`opening | closing | minimizing | idle`). The dispatch to the window manager happens *after* the animation timeout fires. This prevents the animation from getting interrupted by React unmounting the window before the genie completes.

### Storage events glue the system together.

`createLocalStorageAdapter()` dispatches a custom `CustomEvent` on every write, plus listens for the native `storage` event (cross-tab). Any feature that depends on persisted state (Spotlight history, Settings, downloads folder) should subscribe via `storage.subscribe(...)`, never poll. Same pattern Mintables proved out: write to storage, dispatch event, subscribers update.

## Adding things

### A new component

Lives in `packages/desktop/src/`. Reads tokens via `useTheme()`, app data via `useApps()` or `useApp(id)`, window state via `useWindowManager()`. Inline styles consumed from theme tokens for phase 1.

Export it from `packages/desktop/src/index.ts` so consumers can use it directly in depth-2 compositions.

### A new theme

Create `packages/theme-<name>/` with the same shape as `theme-default`. Implement every field of `OsTheme`. If your theme needs a token category that does not exist yet, add it to the `OsTheme` type in `core` first and update `theme-default` to supply a sensible value. Never branch in components on `theme.id === "mytheme"`; if a component needs theme-conditional behavior, that conditional belongs in a token.

### A system app (phase 2 onward)

System apps (Settings, file explorers, etc.) are first-class windows with `payload: { kind: "system", systemId: "settings" }`. Same window-manager primitives, just a different render path in the WindowLayer dispatch. Their content lives in `packages/desktop/src/system/<name>/`.

## Phase plan

- **Phase 1 (shipped).** Workspace scaffold, window manager + types + storage, baseline theme, components: Desktop / Wallpaper / MenuBar / Dock / WindowLayer / Window (with traffic lights, drag, focus, minimize genie).
- **Phase 2.** Resize handles, ESC-from-maximize, keyboard shortcuts (Cmd-W/M/1..9/K), Spotlight, Settings app + customizable schema, the storage-backed user prefs layer.
- **Phase 3.** `@react-ui-os/theme-mintables` cinematic theme. Settings inspector dev tool. CSS variables under the tokens (groundwork for runtime theming if we ever want it).

## Writing rules

- **No em dashes (—) or en dashes (–).** Anywhere. Not in docs, not in user-facing copy, not in commit messages, not in code comments. Use commas, colons, periods, parentheses. This is a hard rule. Pre-existing dashes from imported third-party content are not in scope for cleanup, but never introduce new ones.
- **No marketing-y headers** ("Effortless," "Powerful," "Beautiful"). The library does the work; the docs describe it plainly.
- **Code over prose** when explaining an API. One real snippet beats three paragraphs.

## Conventions

- Public API barrels live at the package's `src/index.ts`.
- Type-only exports use `export type { … }`.
- `"use client"` directive at the top of every file that uses hooks or DOM APIs. Tree-shakes cleanly and works for any consumer that ever adds RSC.
- Component files are `PascalCase.tsx`. Hook files, types, and pure utilities are `kebab-case.ts(x)`.
- Tests live in `tests/` next to `src/`, mirroring the structure. Vitest with `environment: "node"` for pure logic.
- SSR-safety: any `window` / `document` access must be guarded (`typeof window === "undefined"` check). The library should mount cleanly in Next.js, Remix, Astro islands, and Vite-SSR.
