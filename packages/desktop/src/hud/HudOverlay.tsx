"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useTheme } from "../desktop-context";
import { useReducedMotion } from "../util/use-reduced-motion";
import { getHud, subscribeHud, type ActiveHud } from "./hud-store";

/**
 * Centered floating indicator for transient action feedback ("Snapped
 * Left", "Maximized", "Volume 30%"). Hold-then-fade lifecycle is owned
 * by the HUD store. This component just paints what the store points
 * at and animates the entry / exit.
 */
export function HudOverlay() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const active = useSyncExternalStore(subscribeHud, getHud, () => null);
  const [phase, setPhase] = useState<"enter" | "ready" | "leave">("enter");

  // When a new HUD comes in, run enter; when the store clears it, run leave
  // before unmounting so the fade-out is visible.
  useEffect(() => {
    if (active) {
      setPhase("enter");
      const raf = window.requestAnimationFrame(() => {
        setPhase("ready");
      });
      return () => {
        window.cancelAnimationFrame(raf);
      };
    }
    setPhase("leave");
    return undefined;
  }, [active?.id, active]);

  // Keep the previous payload mounted briefly after the store clears so
  // the leave animation has something to paint.
  const [lastShown, setLastShown] = useState<ActiveHud | null>(null);
  useEffect(() => {
    if (active) setLastShown(active);
    else {
      const t = window.setTimeout(() => setLastShown(null), 200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [active]);

  if (!lastShown) return null;

  const visible = active !== null && phase !== "leave";
  const opacity = visible && phase === "ready" ? 1 : 0;
  // Under reduced motion the HUD holds full size (no scale pop) and the
  // transition below is dropped, so it appears and clears without motion.
  const scale = reducedMotion
    ? 1
    : phase === "enter"
      ? 0.9
      : phase === "ready"
        ? 1
        : 0.94;
  const accent = lastShown.accent ?? theme.palette.accent;
  const hasProgress = typeof lastShown.progress === "number";

  const surface: CSSProperties = {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) scale(${String(scale)})`,
    background: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.windowRadius + 4,
    boxShadow: "0 20px 50px -10px rgba(0,0,0,0.55)",
    padding: hasProgress ? "20px 26px 16px" : "22px 28px",
    minWidth: 220,
    color: theme.palette.textPrimary,
    fontFamily: "inherit",
    zIndex: 1600,
    opacity,
    pointerEvents: "none",
    transition: reducedMotion
      ? "none"
      : "opacity 160ms ease, transform 200ms cubic-bezier(0.2, 0.85, 0.25, 1)",
    textAlign: "center",
  };

  return (
    <div role="status" aria-live="polite" style={surface}>
      {lastShown.icon && (
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 8px",
            display: "grid",
            placeItems: "center",
            color: accent,
          }}
        >
          {lastShown.icon}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600 }}>{lastShown.title}</div>
      {lastShown.sublabel && (
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: theme.palette.textSecondary,
          }}
        >
          {lastShown.sublabel}
        </div>
      )}
      {hasProgress && (
        <div
          aria-hidden
          style={{
            marginTop: 12,
            height: 4,
            borderRadius: 2,
            background: theme.palette.border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${String(Math.round(Math.min(1, Math.max(0, lastShown.progress ?? 0)) * 100))}%`,
              background: accent,
              transition: "width 160ms ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
