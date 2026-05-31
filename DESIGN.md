# react-ui-os Design System

The library presents itself as an operating system, not a webpage. Every visual decision should reinforce that. This file is the source of truth for the visual direction and how the token system is intended to be used.

`CLAUDE.md` covers the runtime contract (apps, themes, storage). This file covers **how things look and feel**, and the boundaries themes are expected to honor.

## North star

- **The skeleton is intentionally generic.** The default install reads as "a stock OS without your wallpaper": neutral palette, modest accent, soft motion, no branded illustrations. The point is for a new consumer to see clearly which parts are theirs to dress.
- **Native over novel.** Match conventions from macOS, iPadOS, Windows 11. Familiarity beats flair.
- **Material does the work.** Most "decoration" comes from frosted glass, light, and shadow. Not from gradients, borders, or illustrations baked into components.
- **Color signals identity, not mood.** Each app owns one accent. The wallpaper carries the mood. The theme carries the register.
- **Motion is short and physical.** 140 ms to 300 ms for almost everything. No bouncy springs. No looping idle animations on UI. Wallpaper parallax is the only thing that lives.

## The spectrum of themes the skeleton must support

The library is built so the same components can carry very different products. Three reference points worth keeping in mind when making design choices:

1. **Maker / personal-tool theme.** Photographic wallpaper, dark glass surfaces, accent gradients, full macOS-style traffic lights. This is the `theme-mintables` register. Cinematic first paint, demo-friendly.
2. **SaaS / productivity theme.** Light or neutral background, no wallpaper, dock on the left as an app rail, minimal window chrome (no traffic lights, only a close glyph). The library should never assume the dock is at the bottom or that there is a wallpaper.
3. **Retro / playful theme.** Sharp pixel borders, Windows 95 chrome, sound effects. Possible because `chrome.windowControls = "windows"` is a real option and themes can override `shape.windowRadius` to 0.

If a design choice in a component prevents any of these three, the choice is wrong.

## Token categories

The `OsTheme` type defines the contract. This section explains what each category is for and how to think about it when designing a new component or adding a new token.

### `palette`

Surface colors, text colors, baseline accent, hairline borders. Themes set the temperature here (cool dark glass vs. warm light surfaces). Apps can override the baseline `accent` with their own; that per-app accent drives the dock tile gradient, the focused-window top-edge highlight, and any other "this app is here" signal.

### `shape`

Radii. Three sizes is enough: `windowRadius` (large), `dockTileRadius` (large-but-distinct, squircle), `small` (pills, chips, tooltips). Resist adding a fourth before there is a real conflict.

### `motion`

Durations in milliseconds, easings as CSS strings. Five values cover the system: window open, window close (shares `windowOpen*`), dock hover, genie minimize, plus the easings. Add new durations only when a new gesture needs its own pacing.

### `blur`

`backdrop-filter` strings. The library bakes the _application_ of blur into specific surfaces (menu bar, dock, Spotlight); themes decide _how much_. A SaaS-light theme can set both blur values to `"none"` and the components keep working.

### `wallpaper`

The mood layer. `src` is optional; without it, `palette.background` fills the desktop. `parallax` and `vignette` are independent toggles. A theme with no wallpaper is a legitimate choice (some products want a clean canvas).

### `chrome`

The structural variants. This is where the OS spectrum gets honest.

- `windowControls`: `"traffic-lights"` (macOS), `"windows"` (close on right, min/max left of it), `"gnome"` (round symbolic min/max/close on the right, the Adwaita/Yaru look), `"minimal"` (one close glyph, nothing else).
- `dockPosition`: `"bottom"`, `"left"`, `"hidden"`.
- `dockStyle`: `"floating"` (macOS pill), `"bar"` (flush taskbar / GNOME panel).
- `dockAlign`: `"center"` (macOS / Windows 11), `"start"` (GNOME / Windows 10), `"end"`. Bar docks only.
- `launcher`: `"spotlight"` (macOS palette), `"grid"` (GNOME app grid), `"menu"` (Windows Start menu).
- `menuBar`: `"top"` (system-wide menu), `"in-window"` (inside each title bar), `"none"`.
- `menuBarClock`: `"right"` (macOS, in the status cluster), `"center"` (GNOME).
- `menuBarBrand`: whether the top bar carries the brand button. Default `true`; a GNOME theme sets `false`.
- `quickSettings`: when set, the menu-bar status cluster opens the Quick Settings popover (GNOME system menu / macOS Control Center).

The components must respect every combination. A theme that picks `dockPosition: "hidden"` and `menuBar: "none"` should still produce a working desktop (the user opens apps through Spotlight or via `useWindowManager().openWindow` from their own UI).

## What apps contribute visually

An `App` carries three optional visual hooks: `accent`, `icon`, `iconArt`. Themes decide how to use them.

- **Accent** drives the dock tile gradient (top: accent lightened, bottom: accent darkened) and the focused window's top-edge highlight. The library passes the app's accent to the components; themes can choose how saturated, how visible, how loud.
- **Icon** is a small Lucide-style component. Themes render it centered on the dock tile when `iconArt` is absent.
- **IconArt** is a subject illustration drawn at dock-tile size, painted on top of the accent gradient. This is how an app gets visual identity in the dock (Mintables generators ship custom SVG: a cylinder for Tubes, an elbow for Adapters, etc.). Themes that hide the dock can ignore `iconArt` entirely.

## Default theme principles

`theme-default` is the unbranded baseline. Its job is to look "stock" so a consumer immediately sees the shape of the skeleton and knows what to dress.

- Palette: dark, neutral, low saturation. No brand color.
- Wallpaper: none. The palette background fills the desktop.
- Motion: present but understated. Window open and genie minimize use the same gentle easing.
- Chrome: macOS-style traffic lights, bottom dock, top menu bar (the canonical macOS register, so the metaphor reads on first paint).
- Blur: enabled for menu bar and dock at `blur(20px) saturate(160%)`.

Other themes deviate from this baseline. The baseline does not pretend to be one of them.

## Motion philosophy

- **Window open.** ~180 ms ease-out. Translate Y by 6 px + scale from 0.985 to 1. Subtle.
- **Window close.** Mirror of open, played in reverse. Same duration. The window unmounts after the animation completes.
- **Window genie minimize.** ~280 ms cubic-bezier(0.4, 0.0, 0.2, 1). Window scales to 0.08 and translates toward its dock tile's center. The translation distance is computed live from the DOM rect of the matching dock tile, so each window flies to its own home.
- **Dock hover.** ~140 ms ease. Translate Y by -3 px + scale to 1.06. Reverses on `pointerleave`.
- **Wallpaper parallax** (when enabled). Cursor-driven, low amplitude (about 20 px shift across the full viewport), responds at 60 Hz via `requestAnimationFrame`.

Never compete with the OS motion. If a theme adds extra animation to a component, ensure it ends in under 300 ms and does not loop.

## Don'ts

- **Don't put product chrome in the menu bar.** The menu bar is system chrome (brand left, focused-app name + status cluster right). Application-specific actions belong inside the window. Themes can change the look of the menu bar; they cannot turn it into a toolbar.
- **Don't bake product brand into the library.** Brand gradients, brand wallpapers, brand fonts all live in themes. Library defaults are intentionally generic.
- **Don't break the OS metaphor with web surfaces.** A "modal dialog" with a backdrop and centered card is acceptable for Settings; an inline-on-page hero banner is not. If a consumer needs a hero, they put it inside a window.
- **Don't bypass the window manager.** Any draggable, focusable, minimize-able surface should be a real window registered with the manager. Floating panels that look like windows but lack the focus model are an anti-pattern.
- **Don't make tokens conditional on theme id.** If a component needs to behave differently per theme, the difference belongs in a token, not in `theme.id === "mintables"` checks. Add the token to `OsTheme` first.
- **Don't add a CSS file consumers must import.** The library injects its own keyframes via a `StyleInjector` at the Desktop root. Anything beyond that should be inline-styled from tokens.

## Component recipes

### Window

- Background: `palette.surface` + `blur.surface`.
- Border: 1 px solid `palette.border`.
- Radius: `shape.windowRadius` (0 when maximized).
- Shadow: deeper when focused, shallower when unfocused.
- Title bar: 32 px tall, accent-color highlight line at the top edge when focused.
- Traffic lights live inside the title bar. Themes can swap the chrome (`windowControls`) but the position is owned by the component.

### Dock tile

- Squircle (`shape.dockTileRadius`).
- Background: linear-gradient from the app's accent (top) to the same accent at lower alpha (bottom). This gives the tile a subtle vertical sheen without a literal sheen pseudo-element.
- Indicator dot below the tile when the app is open. Bright when focused; dim when minimized or unfocused.
- Hover: translateY(-3px) + scale(1.06) over 140 ms.

### Menu bar

- 28 px tall, sticks to the top.
- Left cluster: brand label. Center-right: focused-app name. Far right: status cluster (clock, system indicators).
- Background: `palette.surface` + `blur.surface`.

## Future visual work (phase 2 onward)

- **Spotlight.** Centered frosted panel that pops in from a small Y offset and scale of 0.985. Search field at the top, sectioned result list below, keyboard hint footer. Backdrop is a semi-transparent black with `blur.spotlight` filter. The accent line at the top of the panel (same gradient as the focused-window highlight) ties Spotlight visually to the rest of the system.
- **Settings.** A real system window (not a dialog) that renders the active theme's `customizable` schema. Each `kind` of customizable field has a renderer: `color-from-palette` becomes a swatch row, `image-pick` becomes a thumbnail grid, `range` becomes a slider, `select` becomes a segmented control.
- **Settings inspector (dev only).** A floating panel for theme authors to twist every token live and copy the result back as JSON. Off by default; opt in with `<Desktop devInspector />`.

## Reference reading

The first long-form articulation of the OS-style approach this library is built on lives at [saschb2b.com/blog/web-app-as-desktop](https://saschb2b.com/blog/web-app-as-desktop). Read it before contributing if you have not seen the source material; it explains _why_ the abstractions look the way they do.
