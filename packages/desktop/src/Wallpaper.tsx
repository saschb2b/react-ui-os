"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./desktop-context";

const PARALLAX_AMPLITUDE_PX = 14;

/**
 * Full-bleed wallpaper layer. The palette background paints under the image
 * so the desktop has a fallback when no image is set. The image scales
 * slightly larger than the viewport so the parallax shift never reveals
 * the bare background.
 */
export function Wallpaper() {
  const theme = useTheme();
  const { wallpaper, palette } = theme;
  const imageRef = useRef<HTMLDivElement | null>(null);

  // Cursor-driven parallax. Subscribes only when the theme asks for it and
  // the user has not opted into reduced motion.
  useEffect(() => {
    if (!wallpaper.parallax || !wallpaper.src) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const tick = () => {
      // Spring toward the target so the shift feels weighted, not 1:1.
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      const el = imageRef.current;
      if (el) {
        el.style.transform = `scale(1.05) translate3d(${String(
          currentX.toFixed(2),
        )}px, ${String(currentY.toFixed(2))}px, 0)`;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Center is 0, edges are ±PARALLAX_AMPLITUDE_PX. Flip the sign so the
      // wallpaper drifts opposite the cursor, like a window into a deeper
      // scene.
      targetX = -((e.clientX / w) * 2 - 1) * PARALLAX_AMPLITUDE_PX;
      targetY = -((e.clientY / h) * 2 - 1) * PARALLAX_AMPLITUDE_PX;
    };

    raf = window.requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, [wallpaper.parallax, wallpaper.src]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        backgroundColor: palette.background,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {wallpaper.src && (
        <div
          ref={imageRef}
          style={{
            position: "absolute",
            inset: 0,
            // Slightly oversized so parallax shifts don't reveal a hard edge.
            transform: wallpaper.parallax ? "scale(1.05)" : "none",
            backgroundImage: `url(${wallpaper.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            willChange: wallpaper.parallax ? "transform" : undefined,
          }}
        />
      )}
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
