# Local-only icon packs

This folder is **gitignored** (except this README). It holds proprietary or
unclear-license icon packs that should not be committed or published, but that
you can drop in locally for OS-exact fidelity in the playground.

The playground reads these paths if the files exist and **falls back to the
bundled permissive icons** (Fluent System Icons, MIT) when they do not, so a
clean checkout still renders.

## Windows (`win11/`)

The Windows theme looks for `win11/<app>.png` here:

```
win11/hello.png   win11/notes.png    win11/calculator.png  win11/clock.png
win11/calendar.png  win11/reminders.png  win11/sketch.png   win11/terminal.png
win11/settings.png  win11/recents.png
```

These are 32px PNGs cropped from a third-party "Windows 11 Icon Pack" (the icon
designs are Microsoft's; the pack carries no open license), so they live here
rather than in the repo. Without them, the Windows dock uses the MIT Fluent
glyphs.

## macOS (`macos/`)

The macOS theme can render full-color macOS app icons full-bleed (no accent
squircle) from `macos/<app>.png` (`hello`, `notes`, `calculator`, `clock`,
`calendar`, `reminders`, `sketch`, `terminal`). This is **opt-in**: set
`LOCAL_MACOS_ICONS = true` in `apps/playground/src/App.tsx` after dropping a
pack in, because unlike the bare Windows/Ubuntu icons the macOS dock uses
squircles, and a bare fallback glyph would look wrong. Off by default, the dock
keeps the built-in line glyph on an accent squircle.

Apple's macOS icons (SF Symbols and product icons) are license-restricted, so
nothing is committed here. Ubuntu's Yaru icons are CC-BY-SA and ship in
`public/yaru/` instead.
