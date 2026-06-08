# @react-ui-os/icons

A curated, license-vetted set of app icons kept in this repo, so building a new
app means picking from here instead of sourcing icons externally each time.

Every icon is a plain `({ size }) => JSX` component that renders at `size` px and
inherits color via `currentColor` (the line set) or per-pane fills (the fluent
set), so the dock can tint or place it.

## Styles

The library selects an app's icon by the active theme's `chrome.iconStyle`, so an
app provides one component per style it wants to support:

| Style  | Export suffix   | Used by        | Source / license                      |
| ------ | --------------- | -------------- | ------------------------------------- |
| line   | `XxxIcon`       | macOS, default | Original stroke glyphs (this library) |
| fluent | `XxxFluentIcon` | Windows        | Microsoft Fluent System Icons, MIT    |

```ts
import { NotesIcon, NotesFluentIcon } from "@react-ui-os/icons";

const notesApp: App = {
  id: "notes",
  name: "Notes",
  icon: NotesIcon, // default (macOS, generic)
  icons: { fluent: NotesFluentIcon }, // Windows
  content: Notes,
};
```

## Adding icons

Add the `line` variant to `src/line.tsx` and the `fluent` variant to
`src/fluent.tsx`, exporting `XxxIcon` / `XxxFluentIcon`. Keep to **permissively
licensed** sources only, so the package stays redistributable:

- line / macOS style: original strokes, or Lucide (ISC), Feather (MIT)
- fluent / Windows style: Fluent System Icons (MIT)
- other permissive sets: Material Symbols (Apache-2.0), Tabler (MIT)

Do not add Apple SF Symbols or macOS product icons (the license forbids using
them as app icons or off Apple platforms), and do not add proprietary Windows
product icons.

## What is not here

- **Ubuntu / Yaru icons** are CC-BY-SA, so they live in the playground demo
  (`apps/playground/public/yaru/`) with attribution, not in this published set.
- **Exact proprietary OS packs** (real Windows or macOS product icons) go in the
  playground's gitignored local drop-in (`apps/playground/public/local/`), never
  committed. The dock falls back to the icons here when a pack is absent.
