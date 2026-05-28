"use client";

import { useWindowManager, windowIdOf } from "@react-ui-os/core";
import type { App } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import {
  DOCK_EDGE_OFFSET,
  DOCK_GAP,
  DOCK_PADDING,
  DOCK_TILE_SIZE,
} from "./util/layout";

export { DOCK_HEIGHT, DOCK_WIDTH } from "./util/layout";

/**
 * App dock. Direction follows `theme.chrome.dockPosition`:
 *
 *   "bottom"  horizontal pill centered at the bottom of the desktop
 *   "left"    vertical rail centered on the left edge
 *   "hidden"  returns null
 *
 * Clicking a tile toggles: open if not running, focus + restore if minimized
 * or unfocused, otherwise minimize.
 */
export function Dock() {
  const theme = useTheme();
  const apps = useApps();
  const position = theme.chrome.dockPosition;

  if (position === "hidden") return null;

  const isLeft = position === "left";

  return (
    <nav
      aria-label="App dock"
      data-dock-position={position}
      style={{
        position: "fixed",
        ...(isLeft
          ? {
              left: DOCK_EDGE_OFFSET,
              top: "50%",
              transform: "translateY(-50%)",
            }
          : {
              bottom: DOCK_EDGE_OFFSET,
              left: "50%",
              transform: "translateX(-50%)",
            }),
        display: "flex",
        flexDirection: isLeft ? "column" : "row",
        gap: DOCK_GAP,
        padding: DOCK_PADDING,
        backgroundColor: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        border: `1px solid ${theme.palette.border}`,
        borderRadius: theme.shape.dockTileRadius + DOCK_PADDING - 4,
        boxShadow: "0 12px 32px -8px rgba(0,0,0,0.45)",
        zIndex: 1200,
        userSelect: "none",
      }}
    >
      {apps.map((app) => (
        <DockTile key={app.id} app={app} position={position} />
      ))}
    </nav>
  );
}

function DockTile({
  app,
  position,
}: {
  app: App;
  position: "bottom" | "left" | "hidden";
}) {
  const theme = useTheme();
  const {
    windows,
    focusedWindow,
    openWindow,
    focusWindow,
    minimizeWindow,
    restoreWindow,
  } = useWindowManager();
  const id = windowIdOf({ kind: "app", appId: app.id });
  const win = windows.find((w) => w.id === id);
  const isFocused = focusedWindow?.id === id;
  const isMinimized = win?.state === "minimized";

  const handleClick = () => {
    if (!win) {
      openWindow({ kind: "app", appId: app.id });
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

  // Hover lift direction follows the dock's orientation: bottom dock lifts
  // up, left dock lifts inward (to the right).
  const hoverTransform = isLeft
    ? "translateX(3px) scale(1.06)"
    : "translateY(-3px) scale(1.06)";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={app.name}
      data-dock-app-id={app.id}
      style={{
        position: "relative",
        width: DOCK_TILE_SIZE,
        height: DOCK_TILE_SIZE,
        padding: 0,
        border: "none",
        borderRadius: theme.shape.dockTileRadius,
        background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
        cursor: "pointer",
        color: "#fff",
        transition: `transform ${String(theme.motion.dockHoverDurationMs)}ms ease`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onPointerEnter={(e) => {
        e.currentTarget.style.transform = hoverTransform;
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = "translate(0, 0) scale(1)";
      }}
    >
      {Art ? (
        <Art size={Math.round(DOCK_TILE_SIZE * 0.7)} />
      ) : Icon ? (
        <Icon size={Math.round(DOCK_TILE_SIZE * 0.5)} />
      ) : (
        <span
          style={{
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            fontWeight: 700,
            fontSize: 22,
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
                  right: -DOCK_EDGE_OFFSET + 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                }
              : {
                  bottom: -DOCK_EDGE_OFFSET + 2,
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
            transition: `opacity ${String(theme.motion.dockHoverDurationMs)}ms ease`,
          }}
        />
      )}
    </button>
  );
}

/** Returns the DOMRect of a dock tile by its app id, if mounted. */
export function getDockTileRect(appId: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(
    `[data-dock-app-id="${appId}"]`,
  );
  return el ? el.getBoundingClientRect() : null;
}
