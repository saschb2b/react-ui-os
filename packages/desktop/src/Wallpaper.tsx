"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./desktop-context";

// How long a wallpaper dissolves in. A real OS never pops the desktop picture
// in: it composites the wallpaper before showing the desktop, and crossfades on
// change. GNOME waits for the image to load, then fades over
// FADE_ANIMATION_TIME = 1000 ms (gnome-shell js/ui/background.js); macOS
// dissolves a desktop-picture change faster. We split the difference at 700 ms,
// a touch snappier than GNOME because here the fade follows a network fetch,
// while keeping the dissolve smooth rather than a hard cut.
const WALLPAPER_FADE_MS = 700;

// How far the wallpaper drifts from center to edge, in CSS px. Deliberately
// tiny: this is a depth cue, not a moving wallpaper. Apple's parallax is
// tilt-driven, where the device stays mostly still so the image barely shifts;
// a cursor sweeps the whole screen continuously, so the same amplitude reads as
// far more motion. We keep it well under Apple's tilt-range offsets to match
// the "barely there" feel and avoid the motion-sickness a larger drift causes.
const PARALLAX_AMPLITUDE_PX = 8;
// The image is oversized by this factor so the drift never exposes a bare edge.
// 1.04 leaves ~2% of headroom on every side, comfortably more than the small
// amplitude above even on short windows, while keeping the wallpaper from
// looking conspicuously zoomed.
const BASE_SCALE = 1.04;
// Critically damped spring (damping ratio = 1): a weighted ease-in / ease-out
// settle with no bounce. Integrated against real elapsed time so the motion is
// identical at 60Hz and 120Hz. A snappy settle keeps the wallpaper at rest most
// of the time rather than perpetually drifting, which also reads as calmer.
const STIFFNESS = 100;
const DAMPING = 2 * Math.sqrt(STIFFNESS);
// Clamp the per-frame step so returning to a backgrounded tab (where rAF has
// been paused for seconds) eases in from rest rather than snapping across.
const MAX_STEP_S = 1 / 30;

/**
 * Full-bleed wallpaper layer. The palette background paints under the image
 * so the desktop has a fallback when no image is set. The image scales
 * slightly larger than the viewport so the parallax shift never reveals
 * the bare background.
 */
export function Wallpaper() {
  const theme = useTheme();
  const { wallpaper, palette } = theme;
  const src = wallpaper.src;
  const stackRef = useRef<HTMLDivElement | null>(null);

  // Crossfade stack. A new wallpaper is decoded off-screen first, then pushed
  // so it dissolves in over the previous one (the macOS / GNOME behavior);
  // once its fade ends the layers beneath are pruned. Decoding before showing
  // is what stops the abrupt "pop" when the image finishes loading.
  const [layers, setLayers] = useState<{ src: string; id: number }[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!src) {
      setLayers([]);
      return;
    }
    let cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      setLayers((prev) =>
        prev.length > 0 && prev[prev.length - 1]?.src === src
          ? prev
          : [...prev, { src, id: ++idRef.current }],
      );
    };
    const img = document.createElement("img");
    // Hint the browser to fetch the wallpaper ahead of less important assets.
    img.setAttribute("fetchpriority", "high");
    img.src = src;
    // decode() resolves once the image can paint without jank; fall back to
    // revealing anyway if it rejects (e.g. a load error leaves the base color).
    img.decode().then(reveal, reveal);
    return () => {
      cancelled = true;
    };
  }, [src]);

  const handleFadeEnd = () => {
    setLayers((prev) => (prev.length > 1 ? prev.slice(-1) : prev));
  };

  // Honor reduced motion: skip the dissolve and show the wallpaper at once.
  // (A zero-length animation still fires animationend, so pruning is unchanged.)
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
    };
  }, []);
  const fadeMs = reducedMotion ? 0 : WALLPAPER_FADE_MS;

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

    const el = stackRef.current;
    if (!el) return;

    let raf = 0;
    let last = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;

    const render = () => {
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(
        2,
      )}px, 0) scale(${String(BASE_SCALE)})`;
    };

    const tick = (now: number) => {
      // First frame after waking has no reference point: glide from rest.
      const dt = last ? Math.min((now - last) / 1000, MAX_STEP_S) : 0;
      last = now;

      // Semi-implicit Euler: advance velocity from the spring force, then
      // position from the new velocity. Stable and cheap for stiff springs.
      vx += (-STIFFNESS * (x - targetX) - DAMPING * vx) * dt;
      vy += (-STIFFNESS * (y - targetY) - DAMPING * vy) * dt;
      x += vx * dt;
      y += vy * dt;
      render();

      // Park the loop once the spring has effectively settled. A pointer move
      // or a recenter wakes it again, so idle desktops cost zero frames.
      const atRest =
        Math.abs(x - targetX) < 0.05 &&
        Math.abs(y - targetY) < 0.05 &&
        Math.abs(vx) < 2 &&
        Math.abs(vy) < 2;
      if (atRest) {
        x = targetX;
        y = targetY;
        vx = 0;
        vy = 0;
        render();
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf) return;
      last = 0;
      raf = window.requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Center is 0, edges are ±PARALLAX_AMPLITUDE_PX. Flip the sign so the
      // wallpaper drifts opposite the cursor, like a window onto a scene set
      // behind the glass.
      targetX = -((e.clientX / w) * 2 - 1) * PARALLAX_AMPLITUDE_PX;
      targetY = -((e.clientY / h) * 2 - 1) * PARALLAX_AMPLITUDE_PX;
      wake();
    };

    // Ease home when the cursor leaves the viewport or the window loses focus,
    // rather than freezing wherever the drift happened to be.
    const recenter = () => {
      targetX = 0;
      targetY = 0;
      wake();
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", recenter);
    window.addEventListener("blur", recenter);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", recenter);
      window.removeEventListener("blur", recenter);
      if (raf) window.cancelAnimationFrame(raf);
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
      <div
        ref={stackRef}
        style={{
          position: "absolute",
          inset: 0,
          // Slightly oversized so parallax shifts don't reveal a hard edge.
          transform: wallpaper.parallax ? `scale(${String(BASE_SCALE)})` : "none",
          willChange: wallpaper.parallax ? "transform" : undefined,
        }}
      >
        {layers.map((layer, i) => {
          const top = i === layers.length - 1;
          return (
            <div
              key={layer.id}
              onAnimationEnd={top ? handleFadeEnd : undefined}
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${layer.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                // The newest layer dissolves in over the previous ones, which
                // stay opaque underneath until the fade ends and they're pruned.
                animation: top
                  ? `rui-wallpaper-in ${String(fadeMs)}ms ease both`
                  : undefined,
              }}
            />
          );
        })}
      </div>
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
