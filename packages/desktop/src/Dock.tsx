"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  markAllNotificationsRead,
  useNotifications,
  useWindowManager,
  windowIdOf,
} from "@react-ui-os/core";
import type { App } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { openContextMenu, type ContextMenuItem } from "./context-menu";
import { pickInitialBounds } from "./util/initial-bounds";
import { getChromeMetrics } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

export { DOCK_HEIGHT, DOCK_WIDTH } from "./util/layout";

// Cursor-tracking magnification, the macOS dock's signature gesture: the icon
// under the cursor grows, its neighbors fall off over a fixed influence radius,
// and the dock makes room.
//
// The reference smooths every size change with an overdamped spring (mass 0.1,
// stiffness 170, damping 12), which is what keeps it from feeling abrupt. We
// reproduce that character: each frame, every tile's size eases toward its
// cursor-driven target (exponential smoothing, no overshoot, like an overdamped
// spring), and the box and icon scale together from the same value so nothing
// snaps. The peak is kept gentle (1.5x of a 56 px tile, ~84 px) so it reads like
// the macOS default rather than the slider maximum.
// Sources: macOS System Settings > Desktop & Dock > Magnification;
// https://buildui.com/recipes/magnified-dock
const MAG_SCALE = 1.5;
const MAG_DISTANCE = 140;
// Time constant of the size easing, in seconds. ~50 ms reads as responsive but
// smooth, settling in roughly 150 ms.
const SMOOTH_TAU = 0.05;

/**
 * App dock. Direction follows `theme.chrome.dockPosition`:
 *
 *   "bottom"  horizontal pill centered at the bottom of the desktop
 *   "left"    vertical rail centered on the left edge
 *   "hidden"  returns null
 *
 * Hovering magnifies the icons under the cursor (the macOS fisheye) with a
 * smooth, spring-like response. Clicking a tile toggles: open if not running,
 * focus + restore if minimized or unfocused, otherwise minimize.
 */
export function Dock() {
  const theme = useTheme();
  const apps = useApps();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const position = theme.chrome.dockPosition;

  const isLeft = position === "left";
  const isBar = theme.chrome.dockStyle === "bar";
  const base = isBar ? metrics.taskbarTileSize : metrics.dockTileSize;
  const gap = isBar ? 4 : metrics.dockGap;
  const span = base + gap;
  const count = apps.length;
  const mag = theme.motion.dockMagnification ?? MAG_SCALE;

  const [sizes, setSizes] = useState<number[]>(() => apps.map(() => base));
  const sizesRef = useRef<number[]>(sizes);
  const cursorRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  // Latest geometry, refreshed every render so the animation loop (which is
  // created once) always reads current values.
  const geomRef = useRef({ count, base, span, isLeft, mag });
  geomRef.current = { count, base, span, isLeft, mag };

  const tick = useCallback((ts: number) => {
    const dt = lastRef.current ? Math.min((ts - lastRef.current) / 1000, 0.05) : 0.016;
    lastRef.current = ts;
    const k = 1 - Math.exp(-dt / SMOOTH_TAU);
    const g = geomRef.current;
    const cursor = cursorRef.current;
    const center =
      typeof window === "undefined"
        ? 0
        : (g.isLeft ? window.innerHeight : window.innerWidth) / 2;
    const prev = sizesRef.current;
    let moving = false;
    const next: number[] = [];
    for (let i = 0; i < g.count; i++) {
      let target = g.base;
      if (cursor !== null) {
        const off = (i - (g.count - 1) / 2) * g.span;
        const d = Math.abs(cursor - center - off);
        const t = Math.max(0, 1 - d / MAG_DISTANCE);
        const ease = t * t * (3 - 2 * t);
        target = g.base * (1 + (g.mag - 1) * ease);
      }
      const c0 = prev[i] ?? g.base;
      let v = c0 + (target - c0) * k;
      if (Math.abs(target - v) < 0.3) v = target;
      else moving = true;
      next.push(v);
    }
    sizesRef.current = next;
    setSizes(next);
    if (moving || cursorRef.current !== null) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
      lastRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current === null) {
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  // Keep the size array in sync if the app list changes.
  useEffect(() => {
    if (sizesRef.current.length !== count) {
      const resized = Array.from(
        { length: count },
        (_, i) => sizesRef.current[i] ?? base,
      );
      sizesRef.current = resized;
      setSizes(resized);
    }
  }, [count, base]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (position === "hidden") return null;

  const crossSize = base + metrics.dockPadding * 2 + 2;

  const handleMove = (e: ReactPointerEvent) => {
    cursorRef.current = isLeft ? e.clientY : e.clientX;
    startLoop();
  };
  const handleLeave = () => {
    cursorRef.current = null;
    startLoop();
  };

  // Name label above the icon under the cursor, like macOS. Computed from the
  // live (eased) sizes so it glides with the tiles.
  const cursorNow = cursorRef.current;
  let focusedIndex = -1;
  let focusedDist = Infinity;
  if (cursorNow !== null && typeof window !== "undefined") {
    const center = (isLeft ? window.innerHeight : window.innerWidth) / 2;
    apps.forEach((_, i) => {
      const off = (i - (count - 1) / 2) * span;
      const d = Math.abs(cursorNow - center - off);
      if (d < focusedDist) {
        focusedDist = d;
        focusedIndex = i;
      }
    });
  }
  const focusedApp = focusedIndex >= 0 ? apps[focusedIndex] : undefined;
  const showLabel = focusedApp !== undefined && focusedDist < MAG_DISTANCE * 0.55;
  const focusedSize = focusedIndex >= 0 ? (sizes[focusedIndex] ?? base) : base;
  let labelOffset = metrics.dockPadding;
  for (let i = 0; i < focusedIndex; i++) {
    labelOffset += (sizes[i] ?? base) + gap;
  }
  if (focusedIndex >= 0) labelOffset += focusedSize / 2;
  // The taskbar centers its tiles in a full-width bar, so the hover label
  // tracks the tile's resting center (the same anchor magnification uses)
  // rather than the left-packed offset the floating pill needs.
  const barLabelMain =
    typeof window !== "undefined" && focusedIndex >= 0
      ? (isLeft ? window.innerHeight : window.innerWidth) / 2 +
        (focusedIndex - (count - 1) / 2) * span
      : 0;

  const navStyle: CSSProperties = {
    position: "fixed",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: isLeft ? "column" : "row",
    backgroundColor: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    overflow: "visible",
    zIndex: 1200,
    userSelect: "none",
    ...(isBar
      ? {
          // Flush taskbar: full span, square, only an edge-facing hairline.
          alignItems: "center",
          justifyContent: "center",
          gap,
          padding: 0,
          borderRadius: 0,
          ...(isLeft
            ? {
                left: 0,
                top: 0,
                bottom: 0,
                width: metrics.taskbarSize,
                borderRight: `1px solid ${theme.palette.border}`,
                boxShadow: "1px 0 8px rgba(0,0,0,0.12)",
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                height: metrics.taskbarSize,
                borderTop: `1px solid ${theme.palette.border}`,
                boxShadow: "0 -1px 8px rgba(0,0,0,0.12)",
              }),
        }
      : {
          // Floating macOS pill: centered, offset from the edge, rounded.
          alignItems: isLeft ? "flex-start" : "flex-end",
          gap,
          padding: metrics.dockPadding,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: theme.shape.dockTileRadius + metrics.dockPadding - 4,
          boxShadow: "0 12px 32px -8px rgba(0,0,0,0.45)",
          ...(isLeft
            ? {
                left: metrics.dockEdgeOffset,
                top: "50%",
                transform: "translateY(-50%)",
                width: crossSize,
              }
            : {
                bottom: metrics.dockEdgeOffset,
                left: "50%",
                transform: "translateX(-50%)",
                height: crossSize,
              }),
        }),
  };

  return (
    <nav
      aria-label="App dock"
      data-dock-position={position}
      data-rui-dock=""
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={navStyle}
    >
      {apps.map((app, i) => (
        <DockTile
          key={app.id}
          app={app}
          position={position}
          bar={isBar}
          size={Math.round(sizes[i] ?? base)}
          base={base}
        />
      ))}
      {showLabel && focusedApp ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            ...(isBar
              ? isLeft
                ? {
                    top: barLabelMain,
                    left: metrics.taskbarSize + 8,
                    transform: "translateY(-50%)",
                  }
                : {
                    left: barLabelMain,
                    bottom: metrics.taskbarSize + 8,
                    transform: "translateX(-50%)",
                  }
              : isLeft
                ? {
                    top: labelOffset,
                    left: metrics.dockPadding + focusedSize + 12,
                    transform: "translateY(-50%)",
                  }
                : {
                    left: labelOffset,
                    bottom: metrics.dockPadding + focusedSize + 12,
                    transform: "translateX(-50%)",
                  }),
            pointerEvents: "none",
            background: theme.palette.surface,
            backdropFilter: theme.blur.surface,
            WebkitBackdropFilter: theme.blur.surface,
            border: `1px solid ${theme.palette.border}`,
            borderRadius: theme.shape.small,
            padding: "3px 9px",
            fontSize: 12,
            fontWeight: 500,
            color: theme.palette.textPrimary,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 16px -8px rgba(0,0,0,0.5)",
          }}
        >
          {focusedApp.name}
        </span>
      ) : null}
    </nav>
  );
}

function DockTile({
  app,
  position,
  bar,
  size,
  base,
}: {
  app: App;
  position: "bottom" | "left" | "hidden";
  bar: boolean;
  size: number;
  base: number;
}) {
  const theme = useTheme();
  const apps = useApps();
  const {
    windows,
    focusedWindow,
    openWindow,
    focusWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
  } = useWindowManager();
  const { unreadByApp } = useNotifications();
  const id = windowIdOf({ kind: "app", appId: app.id });
  const win = windows.find((w) => w.id === id);
  const isFocused = focusedWindow?.id === id;
  const isMinimized = win?.state === "minimized";
  const badgeCount = unreadByApp[app.id] ?? 0;
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [];
    if (!win) {
      items.push({
        label: `Open ${app.name}`,
        onSelect: () =>
          openWindow(
            { kind: "app", appId: app.id },
            pickInitialBounds({ kind: "app", appId: app.id }, theme, apps),
          ),
      });
    } else {
      items.push({
        label: isFocused ? "Window in front" : "Bring to front",
        disabled: isFocused && !isMinimized,
        onSelect: () => {
          if (isMinimized) restoreWindow(id);
          else focusWindow(id);
        },
      });
      items.push({
        label: isMinimized ? "Restore" : "Minimize",
        shortcut: isMinimized ? undefined : "⌘M",
        onSelect: () => (isMinimized ? restoreWindow(id) : minimizeWindow(id)),
      });
      items.push({
        label: "Close",
        shortcut: "⌘W",
        onSelect: () => closeWindow(id),
      });
    }
    if (badgeCount > 0) {
      items.push({ separator: true });
      items.push({
        label: `Mark ${String(badgeCount)} notification${badgeCount === 1 ? "" : "s"} as read`,
        onSelect: () => markAllNotificationsRead(),
      });
    }
    if (items.length === 0) return;
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
      ariaLabel: `${app.name} dock menu`,
    });
  };

  const handleClick = () => {
    if (!win) {
      openWindow(
        { kind: "app", appId: app.id },
        pickInitialBounds({ kind: "app", appId: app.id }, theme, apps),
      );
      // Windows taskbar buttons do not bounce on launch; the macOS dock does.
      if (!bar) bounce(buttonRef.current, position === "left");
      return;
    }
    if (isMinimized) {
      restoreWindow(id);
      return;
    }
    if (!isFocused) {
      focusWindow(id);
      return;
    }
    minimizeWindow(id);
  };

  const accent = app.accent ?? theme.palette.accent;
  const Art = app.iconArt;
  const Icon = app.icon;
  const isLeft = position === "left";
  const dur = theme.motion.dockHoverDurationMs;
  // The taskbar button is a flat icon button (transparent, hover-highlighted,
  // brand-colored glyph); the floating dock tile is an accent-gradient squircle.
  const radius = bar
    ? theme.shape.small
    : Math.round(theme.shape.dockTileRadius * (size / base));
  const hoverBg = `${theme.palette.textPrimary}14`;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      aria-label={app.name}
      data-dock-app-id={app.id}
      onMouseEnter={(e) => {
        if (bar) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (bar) e.currentTarget.style.background = "transparent";
      }}
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: "none",
        borderRadius: radius,
        background: bar
          ? "transparent"
          : `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
        boxShadow: bar
          ? "none"
          : "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
        cursor: "pointer",
        color: bar ? accent : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: bar ? `background ${String(dur)}ms ease` : undefined,
      }}
    >
      {Art ? (
        <Art size={Math.round(size * 0.7)} />
      ) : Icon ? (
        <Icon size={Math.round(size * 0.5)} />
      ) : (
        <span
          style={{
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            fontWeight: 700,
            fontSize: Math.round(size * 0.4),
            textShadow: bar ? undefined : "0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {app.name.charAt(0).toUpperCase()}
        </span>
      )}
      {win &&
        (bar ? (
          // Windows-style running indicator: an accent underline beneath the
          // icon, wider when focused, a short dim line when running unfocused.
          <span
            aria-hidden
            style={{
              position: "absolute",
              borderRadius: 2,
              backgroundColor: isFocused ? accent : theme.palette.textSecondary,
              opacity: isFocused ? 1 : 0.7,
              transition: `width ${String(dur)}ms ease, height ${String(dur)}ms ease, opacity ${String(dur)}ms ease`,
              ...(isLeft
                ? {
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: isFocused ? 16 : 8,
                  }
                : {
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: isFocused ? 16 : 8,
                    height: 3,
                  }),
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              position: "absolute",
              ...(isLeft
                ? { right: -6, top: "50%", transform: "translateY(-50%)" }
                : { bottom: -6, left: "50%", transform: "translateX(-50%)" }),
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: isFocused
                ? theme.palette.textPrimary
                : theme.palette.textSecondary,
              opacity: isFocused ? 1 : 0.6,
              transition: `opacity ${String(dur)}ms ease`,
            }}
          />
        ))}
      {badgeCount > 0 && (
        <span
          aria-label={`${String(badgeCount)} unread notifications`}
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            background: "#ef4444",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.55)",
            lineHeight: 1,
          }}
        >
          {badgeCount > 99 ? "99+" : String(badgeCount)}
        </span>
      )}
    </button>
  );
}

// macOS-style launch bounce when a dock click opens an app. Uses the Web
// Animations API so it composes with the magnification (which drives the tile
// size, not transform) and leaves no residual transform behind.
function bounce(el: HTMLButtonElement | null, isLeft: boolean): void {
  if (!el || typeof el.animate !== "function") return;
  const up = isLeft ? "translateX(18px)" : "translateY(-18px)";
  const up2 = isLeft ? "translateX(7px)" : "translateY(-7px)";
  const rest = "translate(0, 0)";
  el.animate(
    [
      { transform: rest },
      { transform: up, offset: 0.3 },
      { transform: rest, offset: 0.55 },
      { transform: up2, offset: 0.78 },
      { transform: rest, offset: 1 },
    ],
    { duration: 560, easing: "ease-out" },
  );
}

/** Returns the DOMRect of a dock tile by its app id, if mounted. */
export function getDockTileRect(appId: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-dock-app-id="${appId}"]`);
  return el ? el.getBoundingClientRect() : null;
}
