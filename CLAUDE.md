# react-ui-os

A React component library that ships a working OS-style desktop. Apps are data; themes are token bags; the library does the composition. This document is the architecture reference for anyone (human or AI agent) extending the library.

## Build on the shoulders of giants

This is an OS. Almost every behavior we ship (motion timings and magnitudes, interaction models, keyboard maps, default sizes, easing curves, layout heuristics) has already been solved and tuned by the platforms we imitate: macOS, iOS, Windows, GNOME. Look up how they did it and match it. Never assume, never guess, and never tune by trial and error.

- Before implementing or changing a system behavior, research the reference implementation and find the real values or model. Cite the source in the commit message or a code comment so the next person can verify it.
- "It feels about right" is not a basis. A specific, sourced number or documented behavior is.
- Deviating from the reference is allowed, but only deliberately and with a stated reason. An accidental deviation is a bug.
- When the reference turns out to work differently from what you assumed, that discovery is the point. (Case in point: our wallpaper parallax is cursor-driven, but macOS has no such effect at all, and iOS parallax is tilt-driven and far subtler than a first guess. We only learned that by looking it up, after a round of guessing produced a version that made people dizzy.)

## Finish the whole scope

When research turns up several valid fixes, or a problem has many instances, do all of them. Do not survey the options, fix a convenient subset, and hand back the rest as a backlog. "Found 200 cases, fixed the worst 5" is not done; it is a status report disguised as work.

- If you enumerate options or instances, the default is to complete every one, not to propose a sample. Surface the full list only when you genuinely need a decision (real trade-offs, destructive actions, ambiguous intent), not to offload finishable work.
- A pass over the codebase is complete when a re-run of the same search returns nothing. Verify that way before claiming done.
- Partial completion is allowed only when scope is genuinely unbounded or blocked. Say so explicitly and name what remains and why.

## Tech stack

- **TypeScript 6 strict, ESM + CJS dual bundles** via tsup.
- **React 19** peer dependency. **React Compiler** (babel-plugin-react-compiler) runs at build time, so shipped components are pre-optimized. See "Memoization is the compiler's job".
- **Vite 8** for the playground app, **Astro 6 + Starlight 0.39** for the docs site.
- **Vitest 3** for unit tests.
- **pnpm workspaces + Turborepo** for monorepo orchestration.
- **ESLint + Prettier** for linting and formatting. No Biome.
- **No CSS framework.** Inline styles consumed from theme tokens.

## Commands (from repo root)

- `pnpm dev` - launches `apps/playground` at `http://localhost:5173`
- `pnpm --filter docs dev` - launches `apps/docs` (Starlight) at `http://localhost:4321`
- `pnpm build` - turbo build, produces `dist/` for every library package
- `pnpm typecheck` - tsc + astro check across all packages
- `pnpm test` - vitest across all packages
- `pnpm lint`
- `pnpm format:check` / `pnpm format`

## Repo layout

```
apps/
  docs/                          # Astro Starlight docs site
  playground/                    # Vite + React 19 dev playground
packages/
  core/                          # @react-ui-os/core (pure logic + types)
    src/
      types.ts                   # App, OsTheme, AppContentProps, etc.
      window-manager/            # reducer + context + hooks
      storage/                   # StorageAdapter + localStorage default
      settings/                  # applyPrefs / getPath / setPath
      index.ts                   # public barrel
    tests/
  desktop/                       # @react-ui-os/desktop (components)
    src/
      Desktop.tsx                # one-line API
      DesktopProvider.tsx        # lift-the-hood mode
      Wallpaper.tsx
      MenuBar.tsx                # brand · focused-app · workspaces · status tray · clock
      Dock.tsx                   # per-app indicator dot + unread badge
      WindowLayer.tsx            # filters windows by active workspace
      Window.tsx                 # drag with snap preview + HUD
      launcher/                  # useLauncher hook + Launcher (spotlight / grid / menu)
      Settings.tsx               # renders Slider / Toggle per customizable field
      FileExplorer.tsx
      DesktopIcons.tsx
      AppSwitcher.tsx            # Cmd/Ctrl+Tab MRU overlay
      MissionControl.tsx         # F3 grid of every visible window
      NotificationToasts.tsx     # top-right stack
      NotificationCenter.tsx     # right-edge slide-in sheet
      QuickSettings.tsx          # GNOME system menu / Control Center popover
      desktop-backdrop.tsx       # right-click-the-wallpaper system menu
      keyboard-shortcuts.tsx
      desktop-context.tsx
      system-windows.ts
      spotlight-sources.ts       # registerSpotlightSource registry
      status-items.ts            # registerStatusItem registry
      quick-settings.ts          # registerQuickSetting registry
      events.ts                  # SPOTLIGHT_OPEN_EVENT, NOTIFICATION_CENTER_TOGGLE_EVENT, QUICK_SETTINGS_TOGGLE_EVENT
      style-injector.tsx
      context-menu/              # ContextMenu + Anchor + module store
      snap/                      # snap zone math + SnapPreview
      hud/                       # showHud + HudOverlay
      tooltip/                   # Tooltip primitive
      primitives/                # Slider, Toggle
      util/
      index.ts
  theme-default/                 # @react-ui-os/theme-default (macOS clone)
  theme-windows/                 # @react-ui-os/theme-windows (Windows clone: caption buttons, taskbar)
  theme-ubuntu/                  # @react-ui-os/theme-ubuntu (Ubuntu/GNOME clone: top bar + left dock)
tooling/
  react-compiler-esbuild.mjs     # runs babel-plugin-react-compiler inside the tsup builds
.github/workflows/
  ci.yml                         # typecheck/test/build on push + PR
  docs.yml                       # Pages deploy on push to main
```

## The contract

Every concept in the library is one of these shapes.

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

One object. The dock, menu bar, Spotlight, and keyboard shortcuts all read from the same `App[]` registry. Contributing here lights up four surfaces with no wiring.

### `OsTheme`

```ts
interface OsTheme {
  id: string;
  name: string;
  palette: { background; surface; textPrimary; textSecondary; accent; border };
  shape: { windowRadius; dockTileRadius; small };
  motion: {
    windowOpenDurationMs;
    windowOpenEasing;
    dockHoverDurationMs;
    genieDurationMs;
    genieEasing;
  };
  blur: { surface; spotlight };
  wallpaper: { src?; parallax?; vignette? };
  chrome: { windowControls; dockPosition; menuBar };
  customizable?: Record<string, CustomizableField>;
}
```

Themes are pure data. They depend on `@react-ui-os/core` for types only, never on `@react-ui-os/desktop`. `chrome` is the structural lever (SaaS dock-on-left, retro Windows controls, hidden dock). `customizable` declares which tokens the end user may tweak via the Settings system window.

### `WindowPayload`

```ts
type WindowPayload =
  | { kind: "app"; appId: string }
  | {
      kind: "system";
      systemId: string;
      args?: Record<string, string | number | boolean>;
    };
```

`windowIdOf(payload)` serializes the args into the id so two system windows with distinct args coexist as distinct windows. Backward compatible: omitting args keeps the single-slot behavior.

### `StorageAdapter`

```ts
interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  subscribe(listener: (key: string) => void): () => void;
}
```

Library-owned persistence with a swap. Default is `localStorage` + a custom-event change bus. Override via `<Desktop storage={myAdapter}>` for server-backed sync.

### `SystemWindowDef`

```ts
interface SystemWindowDef {
  name: string | ((args?: SystemWindowArgs) => string);
  tagline?: string;
  accent?: string;
  defaultBounds: { w: number; h: number };
  content: ComponentType<SystemWindowContentProps>;
  appearsAsDesktopIcon?: boolean | ((storage: StorageAdapter) => boolean);
  desktopIcon?: ComponentType<{ size?: number }>;
}
```

`registerSystemWindow(id, def)` adds it to the registry. `appearsAsDesktopIcon` as a function is the state-earned-folder pattern: the icon shows up only once the predicate passes (e.g. once the first item has been written to storage).

### `SpotlightSource`

```ts
type SpotlightSource = (query: string) => SpotlightResult[];
```

`registerSpotlightSource(id, source)` lets any feature contribute results to the Cmd-K palette beyond apps and system windows. Sources are queried on every keystroke; misbehaving sources are caught so they don't tear down the palette.

### `StatusItem`

```ts
interface StatusItem {
  id: string;
  icon: ReactNode;
  tooltip?: string;
  badge?: string | number;
  shortcut?: string;
  onClick?: () => void;
  order?: number;
}
```

`registerStatusItem({ id, icon, ... })` adds a widget to the menu-bar right cluster (between workspaces and the clock). Battery, sync state, online dot, current track. Anything that should live in the system chrome rather than in an app window. Re-registering the same id replaces the previous record so a host component can update its badge without remount churn.

## The imperative-store pattern

These library systems share the same shape: a **module-level vanilla store** + a **component mounted by `<Desktop>` that subscribes via `useSyncExternalStore`** + an **imperative function callable from any code**. This is how features that span "anywhere in the app" stay decoupled from any provider hierarchy. Pattern files:

| System           | Imperative call                  | Renderer mounted by `<Desktop>`                 | Store                           |
| ---------------- | -------------------------------- | ----------------------------------------------- | ------------------------------- |
| Notifications    | `notify({ ... })`                | `<NotificationToasts>` + `<NotificationCenter>` | `core/notifications/store.ts`   |
| Context menu     | `openContextMenu({ x, y, ... })` | `<ContextMenu>`                                 | `desktop/context-menu/store.ts` |
| Window snap      | `setSnapPreview(...)`            | `<SnapPreview>`                                 | `desktop/snap/snap-store.ts`    |
| HUD              | `showHud({ title, ... })`        | `<HudOverlay>`                                  | `desktop/hud/hud-store.ts`      |
| Status tray      | `registerStatusItem(...)`        | `<StatusItems>` inside `<MenuBar>`              | `desktop/status-items.ts`       |
| Quick settings   | `registerQuickSetting(...)`      | `<QuickSettings>`                               | `desktop/quick-settings.ts`     |
| Spotlight source | `registerSpotlightSource(...)`   | inside `<Launcher>`                             | `desktop/spotlight-sources.ts`  |

Reasons:

1. **No prop drilling.** A fetch handler in a deep app can call `notify({...})` without threading a dispatcher down.
2. **Cross-package.** `notify` lives in `core`, the renderer in `desktop`. Stores in `core` are React-free for that reason.
3. **Single source of truth.** Two consumers can't accidentally render two notification stacks.

When adding a new "appears system-wide" feature, follow this shape. Don't reach for a new context provider unless the state legitimately belongs to a subtree.

## Workspaces

Window manager state includes `workspaces: string[]` and `activeWorkspaceId: string`. Every `OpenWindow` has a `workspaceId`. `WindowLayer` filters by the active workspace: switching is an O(n) hide rather than mount/unmount, so window state survives. `FOCUS` on a window from another workspace pulls the user to that workspace (matches the macOS "click a dock tile, jump to that space" behavior).

Defaults: three workspaces, seeded at boot. Actions: `switchWorkspace`, `moveWindowToWorkspace`, `addWorkspace`, `removeWorkspace`. `removeWorkspace` refuses to drop the last and migrates orphan windows to the first remaining workspace.

Keyboard: `Ctrl + Alt + ←/→` switch; `Ctrl + Alt + Shift + ←/→` bring the focused window with you. Window title-bar right-click exposes "Move to Workspace N".

## Package boundaries

- `core` is **pure logic + types**. No JSX outside the window-manager context provider. Never imports `@react-ui-os/desktop`.
- `desktop` is **components only**. Depends on `core` for types, hooks, and the WindowManagerProvider. Never imports a specific theme.
- Themes depend on `core` for types only.

Violations are a signal. If a component needs a token your theme does not have, the token is missing from the contract, not from the theme.

## Three depths of API

The same primitives are reachable at three levels. The library should always let users step down to the next level without rewriting.

1. **`<Desktop apps theme>`.** One tag. Full default composition. Accepts an optional `children` for headless companions that need `useWindowManager()`.
2. **`<DesktopProvider apps theme>` + composed surfaces.** Wrap your own choice of `<Wallpaper>`, `<MenuBar>`, `<Dock>`, `<WindowLayer>`, `<Spotlight>`, `<Settings>`.
3. **`useWindowManager()`, `useTheme()`, `useApps()`, `useApp(id)`, `useSettings()`.** Drive the system from outside the default chrome.

Designs that require depth-3 features for ordinary use cases are a smell. The 80% case should be depth 1.

## Lessons baked into the library

Patterns the system enforces structurally. If you find yourself fighting them, ask whether the fight is justified before adding a workaround.

### Windows are first-class. URLs are downstream.

The window manager is the source of truth, held in React state. Routes (in any consuming app) are observers. Opening the same `App` twice focuses the existing window rather than spawning a duplicate.

### Drag is a layout property, not a state update.

`<Window>` writes `transform` directly to the DOM during a drag. React only learns the result on `pointerup`. This keeps multi-window scenes with heavy content at 60 fps. The same pattern is used for resize handles.

### Animations are state machines, not effects.

Window open / close / minimize use a local `phase` state machine. The dispatch to the window manager happens _after_ the animation timeout fires.

### Storage events glue the system together.

`createLocalStorageAdapter()` dispatches a custom `CustomEvent` on every write, plus listens for the native `storage` event for cross-tab updates. Any feature that depends on persisted state (Settings, downloads, presets, state-earned folders) subscribes via `storage.subscribe(...)`. Never poll.

### Memoization is the compiler's job.

React Compiler runs on the library. The playground compiles workspace source through `@rolldown/plugin-babel` + `reactCompilerPreset`; the tsup builds run it via `tooling/react-compiler-esbuild.mjs` so the published `dist` ships pre-optimized. Write components without manual `useMemo` / `useCallback`: the compiler memoizes derived values and handler identities. `eslint-plugin-react-hooks` 7 surfaces the compiler diagnostics as warnings (an incremental-adoption choice on an existing codebase); `rules-of-hooks` stays an error.

Keep manual memoization only where the compiler cannot help: a value whose stable identity feeds a `useEffect` dependency array (without the wrapper the effect re-subscribes every render, and `exhaustive-deps` flags it), or a value passed into a hook the compiler bailed on. The compiler skips any component or hook it cannot prove safe rather than miscompiling it, so a bail-out is a silent loss of optimization, not an error; the ESLint warnings (refs-during-render, setState-in-effect, and so on) mark the code that bails. Removing redundant memoization is a cleanup, never required: leaving it in place is also fine.

### Three uniform contribution shapes.

The whole "ecosystem feel" lives in this: adding to the system is always one of three shapes.

- An `App` lights up the dock, menu bar, Spotlight, and keyboard shortcuts.
- A `SystemWindowDef` registered via `registerSystemWindow(...)` adds a system window plus an optional desktop shortcut.
- A `SpotlightSource` registered via `registerSpotlightSource(...)` adds findable rows to Cmd-K.

All three are declarative. All three persist via the same event-driven storage pattern.

## Adding things

### A new component

Lives in `packages/desktop/src/`. Reads tokens via `useTheme()`, app data via `useApps()` or `useApp(id)`, window state via `useWindowManager()`. Inline styles consumed from theme tokens. Skip manual `useMemo` / `useCallback`: the compiler handles it (see "Memoization is the compiler's job" for the two cases where it stays).

Export it from `packages/desktop/src/index.ts` so consumers can use it directly in depth-2 compositions.

### A new theme

Create `packages/theme-<name>/` with the same shape as `theme-default`. Export a static `OsTheme` for simple themes or a `createXxxTheme(opts)` factory when the theme needs consumer-supplied assets (wallpapers, accents). Never branch in components on `theme.id === "mytheme"`; if a component needs theme-conditional behavior, that conditional belongs in a token.

### A new system window

Call `registerSystemWindow(id, def)` once at module load. The window is then openable via `openWindow({ kind: "system", systemId: id, args? })`. For multi-instance windows (one per `args` set), pass `name` as a `(args) => string` function so the title reflects the arg.

### A new Spotlight source

Call `registerSpotlightSource(id, query => results)` at module load or inside a `useEffect`. Each result needs `id`, `name`, and `onActivate`; optional `tagline`, `accent`, `icon`, and `kindLabel`.

## Phase history

- **Phase 1.** Workspace scaffold, window manager + types + storage, default theme, baseline components (Desktop, Wallpaper, MenuBar, Dock, WindowLayer, Window with traffic lights, drag, focus, minimize genie).
- **Phase 2a.** Resize handles, ESC-from-maximize, keyboard shortcuts (Cmd-W/M/1..9/K), Spotlight.
- **Phase 2b.** Settings as a system window + the `customizable` schema + effective-theme overlay.
- **Phase 3.** The first branded theme and chrome variants (dock-on-left, hidden menu bar). Wallpaper parallax.
- **Phase 4.** FileExplorer primitive with full macOS-Finder interaction model. State-earned desktop folders.
- **Phase 5.** Bundling via tsup. Docs site rebuilt on Astro Starlight. `SystemWindowArgs` for multi-instance system windows. `registerSpotlightSource` for arbitrary result kinds. CI + Pages deploy.
- **Phase 6.** Vite 8 and TypeScript 6. React Compiler integrated across the playground, the tsup library builds (`tooling/react-compiler-esbuild.mjs`, so `dist` is pre-compiled), and the `eslint-plugin-react-hooks` 7 diagnostics. Redundant manual memoization removed where the compiler covers it.
- **Phase 7.** OS-clone themes: macOS (`theme-default` with the Tahoe wallpaper), Windows (`theme-windows`), and Ubuntu (`theme-ubuntu`), each modeled on its platform's chrome. The on-canvas theme switcher in both playgrounds. The earlier cinematic and SaaS themes were dropped to focus on faithful platform clones.

## No AI slop

AI-generated work has a recognizable texture: padded prose, decorative styling with no function, and comments that narrate the code. It reads as generated, not authored. None of it ships here. The three sub-sections below are hard rules, not preferences. They restate and extend the design discipline in `DESIGN.md` ("Material does the work"); when in doubt, the more restrained option wins.

### Prose (docs, copy, comments, commit messages)

- **No em dashes (—) or en dashes (–).** Anywhere. Not in docs, not in user-facing copy, not in commit messages, not in code comments. Use commas, colons, periods, parentheses. Pre-existing dashes from imported third-party content are not in scope for cleanup, but never introduce new ones.
- **No marketing-y headers** ("Effortless," "Powerful," "Beautiful"). The library does the work; the docs describe it plainly. Headers name the thing, they do not sell it.
- **No fluff adjectives.** Banned: seamless, powerful, effortless, beautiful, robust, rich, comprehensive, intuitive, elegant, blazing, lightning-fast, cutting-edge, state-of-the-art, delightful, stunning. Describe what it does, not how it makes you feel.
- **No AI-tell verbs and openers.** Banned: leverage (use "use"), delve, dive in / dive into, elevate, unlock, empower, harness, boast(s), "in today's world", "in conclusion", "it's worth noting", "that being said", "look no further", "the world of". Cut filler transitions ("As you can see", "Simply put", "Notably") entirely.
- **No rule-of-three padding.** Do not pad with three parallel adjectives ("fast, simple, and reliable") when the sentence carries its meaning without them.
- **No emoji** in headings, prose, UI copy, or comments. Unicode glyphs that carry meaning (⌘ ⇧ ↵ for shortcuts) are fine.
- **Code over prose** when explaining an API. One real snippet beats three paragraphs.

### Visual (components, themes, playground, docs)

Real operating systems (macOS, iOS, Windows 11, GNOME) are restrained. They do not decorate chrome to look busy. Decoration that serves no UX purpose is the most common AI tell in UI code, and it directly violates `DESIGN.md`. The rule: **accent color and shadow are affordances, not garnish.**

- **No decorative accent borders or stripes.** No `borderTop`/`borderLeft`/`border` in an accent color used as visual flair, no underline accents, no `repeating-linear-gradient` stripe patterns standing in for real content. Chrome separators are a 1px `palette.border` hairline or nothing.
- **No glows.** No accent-tinted `box-shadow` (`0 0 6px ${accent}aa`), no stacked inner+outer glow, no colored focus ring layered over a drop shadow. Shadows are neutral (black at low alpha) and convey elevation only. A focus or selection state is a `palette.accent` outline or a subtle background fill, not a glow.
- **No decorative gradients.** Gradients are reserved for the few signals `DESIGN.md` sanctions (below). Do not gradient-fill buttons, cards, headers, chips, or toast icons for "depth."
- **Accent marks small affordances, not large surfaces.** Use accent for the focus ring, the selected row, the indicator dot, the progress fill. Do not flood backgrounds, full headers, or large panels with accent.
- **Read tokens, never hardcode look.** Radii come from `theme.shape` (`windowRadius`, `dockTileRadius`, `small`), durations and easings from `theme.motion`, colors and hairlines from `theme.palette`, blur from `theme.blur`. No inline `borderRadius: 9`, no `rgba(120,160,220,0.55)`, no `transition: "... 140ms ease"`, no magic opacity. If a value you need is missing, add a token to the contract, do not invent one inline. (See "Package boundaries": a missing token is a contract gap, not a license to hardcode.)
- **Sanctioned accent use (this is the whole allowlist, not examples):** the dock-tile gradient (app accent top to lower-alpha accent bottom), the focused window's top-edge highlight line, and the Spotlight top accent line. These are defined in `DESIGN.md`. Anything beyond this list needs a stated UX reason in a code comment or it is slop.
- **Match the reference, do not guess** (see "Build on the shoulders of giants"). Motion timings, sizes, and easings come from the platform being imitated, cited, not tuned by feel.

### Code

The current baseline is good; keep it. The point of these rules is to stop regressions, not to start adding ceremony.

- **No comments that restate the code.** No `// increment counter` over `counter++`, no `// set the state`, no narration of the next line. Comments earn their place by explaining _why_, a non-obvious constraint, or a reference (a platform behavior, a spec, a citation).
- **No banner / divider comments** (`// ===== HELPERS =====`). Let the code structure speak. (The one existing exception, the section markers in the 1400-line `FileExplorer.tsx`, is a deliberate, consistent pattern in a single oversized file, not a template to copy.)
- **No JSDoc that just restates the function name.** Document behavior, edge cases, and lifecycle, or omit it.
- **No leftover debug.** No stray `console.log`, no unowned `TODO`/`FIXME`. A guarded, prefixed dev warning (like the Spotlight source guard) is fine; raw logging is not.

## Conventions

- Public API barrels live at the package's `src/index.ts`.
- Type-only exports use `export type { … }`.
- `"use client"` directive at the top of every file that uses hooks or DOM APIs.
- Component files are `PascalCase.tsx`. Hook files, types, and pure utilities are `kebab-case.ts(x)`.
- Tests live in `tests/` next to `src/`, mirroring the structure. Vitest with `environment: "node"` for pure logic.
- SSR-safety: any `window` / `document` access must be guarded (`typeof window === "undefined"` check). The library should mount cleanly in Next.js, Remix, Astro islands, and Vite-SSR.
