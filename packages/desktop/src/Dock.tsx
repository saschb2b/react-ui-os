"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
// and the dock makes room. The well-known macOS approximation uses a ~110 px
// radius and a 2.25x peak; we use a gentler peak over a slightly wider radius
// so a 56 px tile tops out near 100 px.
// Sources: macOS System Settings > Desktop & Dock > Magnification;
// https://buildui.com/recipes/magnified-dock
const MAG_SCALE = 1.8;
const MAG_DISTANCE = 130;

/**
 * App dock. Direction follows `theme.chrome.dockPosition`:
 *
 *   "bottom"  horizontal pill centered at the bottom of the desktop
 *   "left"    vertical rail centered on the left edge
 *   "hidden"  returns null
 *
 * Hovering magnifies the icons under the cursor (the macOS fisheye). Clicking a
 * tile toggles: open if not running, focus + restore if minimized or unfocused,
 * otherwise minimize.
 */
export function Dock() {
  const theme = useTheme();
  const apps = useApps();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const position = theme.chrome.dockPosition;

  const [cursor, setCursor] = useState<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  if (position === "hidden") return null;

  const isLeft = position === "left";
  const base = metrics.dockTileSize;
  const span = base + metrics.dockGap;
  const count = apps.length;
  // Fix the panel's cross-axis to its resting size so magnified tiles overflow
  // above (or beside) it rather than ballooning the whole panel, like macOS.
  const crossSize = base + metrics.dockPadding * 2 + 2;

  // Resting layout is symmetric around the dock center, which sits at the
  // viewport center because the dock is centered. That makes each tile's size a
  // pure function of the cursor with no layout-measurement feedback loop.
  const viewportCenter =
    typeof window === "undefined"
      ? 0
      : (isLeft ? window.innerHeight : window.innerWidth) / 2;
  const tiles = apps.map((app, i) => {
    if (cursor === null) return { app, size: base, dist: Infinity };
    const restOffset = (i - (count - 1) / 2) * span;
    const dist = Math.abs(cursor - viewportCenter - restOffset);
    const t = Math.max(0, 1 - dist / MAG_DISTANCE);
    const ease = t * t * (3 - 2 * t);
    return { app, size: Math.round(base * (1 + (MAG_SCALE - 1) * ease)), dist };
  });
  let focusedIndex = -1;
  if (cursor !== null) {
    let bestDist = Infinity;
    tiles.forEach((t, i) => {
      if (t.dist < bestDist) {
        bestDist = t.dist;
        focusedIndex = i;
      }
    });
  }
  const focusedTile = focusedIndex >= 0 ? tiles[focusedIndex] : undefined;
  // Name label appears above the icon under the cursor, like macOS.
  const showLabel = focusedTile !== undefined && focusedTile.dist < MAG_DISTANCE * 0.55;
  // Offset of the focused tile's center along the dock's main axis, from the
  // nav's leading inner edge, using the live magnified sizes.
  let labelOffset = metrics.dockPadding;
  for (let i = 0; i < focusedIndex; i++) {
    const ti = tiles[i];
    if (ti) labelOffset += ti.size + metrics.dockGap;
  }
  if (focusedTile) labelOffset += focusedTile.size / 2;

  const handleMove = (e: ReactPointerEvent) => {
    targetRef.current = isLeft ? e.clientY : e.clientX;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setCursor(targetRef.current);
    });
  };
  const handleLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCursor(null);
  };

  return (
    <nav
      aria-label="App dock"
      data-dock-position={position}
      data-rui-dock=""
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{
        position: "fixed",
        boxSizing: "border-box",
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
        display: "flex",
        flexDirection: isLeft ? "column" : "row",
        alignItems: isLeft ? "flex-start" : "flex-end",
        gap: metrics.dockGap,
        padding: metrics.dockPadding,
        backgroundColor: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        border: `1px solid ${theme.palette.border}`,
        borderRadius: theme.shape.dockTileRadius + metrics.dockPadding - 4,
        boxShadow: "0 12px 32px -8px rgba(0,0,0,0.45)",
        overflow: "visible",
        zIndex: 1200,
        userSelect: "none",
      }}
    >
      {tiles.map(({ app, size }) => (
        <DockTile
          key={app.id}
          app={app}
          position={position}
          size={size}
          base={base}
          magnifying={cursor !== null}
        />
      ))}
      {showLabel && focusedTile ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            ...(isLeft
              ? {
                  top: labelOffset,
                  left: metrics.dockPadding + focusedTile.size + 12,
                  transform: "translateY(-50%)",
                }
              : {
                  left: labelOffset,
                  bottom: metrics.dockPadding + focusedTile.size + 12,
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
          {focusedTile.app.name}
        </span>
      ) : null}
    </nav>
  );
}

function DockTile({
  app,
  position,
  size,
  base,
  magnifying,
}: {
  app: App;
  position: "bottom" | "left" | "hidden";
  size: number;
  base: number;
  magnifying: boolean;
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
      bounce(buttonRef.current, position === "left");
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
  const radius = Math.round(theme.shape.dockTileRadius * (size / base));

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      aria-label={app.name}
      data-dock-app-id={app.id}
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: "none",
        borderRadius: radius,
        background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
        cursor: "pointer",
        color: "#fff",
        // No transition while magnifying so the lens tracks the cursor at
        // 60 fps; a transition only on release settles the icons back down.
        transition: magnifying
          ? "none"
          : `width ${String(dur)}ms ease, height ${String(dur)}ms ease, border-radius ${String(dur)}ms ease`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {app.name.charAt(0).toUpperCase()}
        </span>
      )}
      {win && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            ...(isLeft
              ? {
                  right: -6,
                  top: "50%",
                  transform: "translateY(-50%)",
                }
              : {
                  bottom: -6,
                  left: "50%",
                  transform: "translateX(-50%)",
                }),
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
      )}
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
// Animations API so it composes with the magnification (which drives
// width/height, not transform) and leaves no residual transform behind.
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
