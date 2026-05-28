"use client";

import {
  markAllNotificationsRead,
  useNotifications,
  useWindowManager,
  windowIdOf,
} from "@react-ui-os/core";
import type { App } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import {
  openContextMenu,
  type ContextMenuItem,
} from "./context-menu";
import { Tooltip } from "./tooltip";
import { pickInitialBounds } from "./util/initial-bounds";
import { getChromeMetrics } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

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
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const position = theme.chrome.dockPosition;

  if (position === "hidden") return null;

  const isLeft = position === "left";

  return (
    <nav
      aria-label="App dock"
      data-dock-position={position}
      data-rui-dock=""
      style={{
        position: "fixed",
        ...(isLeft
          ? {
              left: metrics.dockEdgeOffset,
              top: "50%",
              transform: "translateY(-50%)",
            }
          : {
              bottom: metrics.dockEdgeOffset,
              left: "50%",
              transform: "translateX(-50%)",
            }),
        display: "flex",
        flexDirection: isLeft ? "column" : "row",
        gap: metrics.dockGap,
        padding: metrics.dockPadding,
        backgroundColor: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        border: `1px solid ${theme.palette.border}`,
        borderRadius: theme.shape.dockTileRadius + metrics.dockPadding - 4,
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
  const apps = useApps();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
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
        onSelect: () =>
          isMinimized ? restoreWindow(id) : minimizeWindow(id),
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
    <Tooltip
      text={app.name}
      shortcut={isLeft ? undefined : undefined}
      placement={isLeft ? "right" : "top"}
    >
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      data-dock-app-id={app.id}
      style={{
        position: "relative",
        width: metrics.dockTileSize,
        height: metrics.dockTileSize,
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
        <Art size={Math.round(metrics.dockTileSize * 0.7)} />
      ) : Icon ? (
        <Icon size={Math.round(metrics.dockTileSize * 0.5)} />
      ) : (
        <span
          style={{
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
            fontWeight: 700,
            fontSize: Math.round(metrics.dockTileSize * 0.4),
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
                  right: -metrics.dockEdgeOffset + 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                }
              : {
                  bottom: -metrics.dockEdgeOffset + 2,
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
    </Tooltip>
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
