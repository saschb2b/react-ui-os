"use client";

import { useWindowManager, windowIdOf } from "@react-ui-os/core";
import type { App } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";

const DOCK_TILE_SIZE = 56;
const DOCK_GAP = 10;
const DOCK_PADDING = 10;
const DOCK_BOTTOM_OFFSET = 14;

export const DOCK_HEIGHT = DOCK_TILE_SIZE + DOCK_PADDING * 2;

/**
 * Bottom-floating dock that lists the registered apps. Click toggles:
 * open if not running, focus + restore if minimized or unfocused, otherwise
 * minimize. The indicator dot below each tile reflects window state.
 */
export function Dock() {
  const theme = useTheme();
  const apps = useApps();

  if (theme.chrome.dockPosition === "hidden") return null;

  return (
    <nav
      aria-label="App dock"
      style={{
        position: "fixed",
        bottom: DOCK_BOTTOM_OFFSET,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
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
        <DockTile key={app.id} app={app} />
      ))}
    </nav>
  );
}

function DockTile({ app }: { app: App }) {
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
        e.currentTarget.style.transform = "translateY(-3px) scale(1.06)";
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
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
            bottom: -DOCK_BOTTOM_OFFSET + 2,
            left: "50%",
            transform: "translateX(-50%)",
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
