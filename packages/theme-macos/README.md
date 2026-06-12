# @react-ui-os/theme-macos

The macOS theme: traffic lights, a floating dock with the fisheye, a
translucent top menu bar, light and dark appearances modeled on Tahoe.

```tsx
import { Desktop } from "@react-ui-os/desktop";
import { createMacosTheme } from "@react-ui-os/theme-macos";

const theme = createMacosTheme({
  wallpaperSrc: "/wallpapers/tahoe-day.jpg",
  darkWallpaperSrc: "/wallpapers/tahoe-night.jpg",
});

<Desktop apps={apps} theme={theme} />;
```

Themes do not bundle assets; you supply the wallpaper paths. With no wallpaper
the theme reads as the unbranded baseline, exported ready-made as `macosTheme`
for a zero-config drop-in.

## Options

- `accent`: overrides the macOS Blue control accent.
- `wallpaperSrc` / `darkWallpaperSrc`: per-appearance wallpapers.
- `wallpaperOptions`: enables the wallpaper picker in Settings > Appearance.
- `liquidGlass`: opt-in Tahoe refraction on Chromium; others fall back to blur.

A theme is pure data (`OsTheme` from `@react-ui-os/core`): palette, shape,
motion, blur, elevation, chrome, plus a `customizable` block that declares
which tokens end users may tweak from the Settings window. Values are sourced
from the platform being imitated; sources are cited in the code.
