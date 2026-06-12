# @react-ui-os/theme-windows

The Windows 11 theme: caption buttons, a full-width bottom taskbar with the
Start menu, Mica surfaces, Fluent shape and motion, light and dark appearances.

```tsx
import { Desktop } from "@react-ui-os/desktop";
import { createWindowsTheme } from "@react-ui-os/theme-windows";

const theme = createWindowsTheme({
  wallpaperSrc: "/wallpapers/bloom-light.jpg",
  darkWallpaperSrc: "/wallpapers/bloom-dark.jpg",
});

<Desktop apps={apps} theme={theme} />;
```

Themes do not bundle assets; you supply the wallpaper paths.

## Options

- `accent`: overrides the Windows "Default blue" (#0078d4).
- `wallpaperSrc` / `darkWallpaperSrc`: per-appearance wallpapers.
- `wallpaperOptions`: enables the wallpaper picker in Settings > Appearance.

The `customizable` block mirrors Windows Settings > Personalization: taskbar
alignment, position, button sizing and combining, auto-hide, and the Start
menu size and section toggles. A theme is pure data (`OsTheme` from
`@react-ui-os/core`); values are sourced from the Windows 11 design
guidelines, cited in the code.
