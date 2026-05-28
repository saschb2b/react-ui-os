"use client";

import { useTheme } from "./desktop-context";

/**
 * Full-bleed wallpaper layer. When the theme supplies an image, it covers the
 * desktop with a vignette overlay if enabled; otherwise the palette
 * background color fills the screen.
 */
export function Wallpaper() {
  const theme = useTheme();
  const { wallpaper, palette } = theme;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        backgroundColor: palette.background,
        backgroundImage: wallpaper.src ? `url(${wallpaper.src})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        pointerEvents: "none",
      }}
    >
      {wallpaper.vignette && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
