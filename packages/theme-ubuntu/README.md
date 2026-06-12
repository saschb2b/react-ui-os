# @react-ui-os/theme-ubuntu

The Ubuntu/GNOME theme: a top bar with a centered clock and Quick Settings, a
flat left dock with no fisheye, Adwaita/Yaru window controls, Yaru colors in
dark and light appearances.

```tsx
import { Desktop } from "@react-ui-os/desktop";
import { createUbuntuTheme } from "@react-ui-os/theme-ubuntu";

const theme = createUbuntuTheme({
  wallpaperSrc: "/wallpapers/yaru-dark.jpg",
  lightWallpaperSrc: "/wallpapers/yaru-light.jpg",
});

<Desktop apps={apps} theme={theme} />;
```

Themes do not bundle assets; you supply the wallpaper paths. Ubuntu's base
look is dark, so the light appearance is the override.

## Options

- `accent`: overrides the Yaru orange (#E95420).
- `wallpaperSrc` / `lightWallpaperSrc`: per-appearance wallpapers.
- `wallpaperOptions`: enables the wallpaper picker in Settings > Appearance.
- `launcherIconSrc`: path to the real Yaru Show Applications glyph; without it
  the launcher button falls back to a drawn Circle of Friends.

A theme is pure data (`OsTheme` from `@react-ui-os/core`); shape follows
libadwaita, motion follows GNOME Shell, with sources cited in the code.
