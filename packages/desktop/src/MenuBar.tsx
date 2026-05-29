"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { notify, useNotifications, useWindowManager } from "@react-ui-os/core";
import { useApp, useApps, useTheme } from "./desktop-context";
import { openContextMenu } from "./context-menu";
import { NOTIFICATION_CENTER_TOGGLE_EVENT } from "./events";
import { pickInitialBounds } from "./util/initial-bounds";
import { listStatusItems, subscribeStatusItems, type StatusItem } from "./status-items";
import { getSystemWindow, resolveSystemWindowName } from "./system-windows";
import { Tooltip } from "./tooltip";
import { getChromeMetrics, MENU_BAR_HEIGHT } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

export { MENU_BAR_HEIGHT };

/**
 * System chrome at the top of the desktop. Left: brand. Center-right: the
 * focused app's name. Right: a small status cluster (live clock). Returns
 * null when `theme.chrome.menuBar` is "none".
 */
export function MenuBar({ brand = "react-ui-os" }: { brand?: string }) {
  const theme = useTheme();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const apps = useApps();
  const { focusedWindow, openWindow } = useWindowManager();
  const focusedApp = useApp(
    focusedWindow?.payload.kind === "app" ? focusedWindow.payload.appId : "__none__",
  );
  const focusedSystem =
    focusedWindow?.payload.kind === "system"
      ? getSystemWindow(focusedWindow.payload.systemId)
      : undefined;
  const focusedSystemArgs =
    focusedWindow?.payload.kind === "system" ? focusedWindow.payload.args : undefined;
  const focusedName =
    focusedApp?.name ??
    (focusedSystem
      ? resolveSystemWindowName(focusedSystem, focusedSystemArgs)
      : undefined);

  if (theme.chrome.menuBar !== "top") return null;

  // The brand acts as the macOS Apple menu: a system menu anchored at top-left.
  const openBrandMenu = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    openContextMenu({
      x: r.left,
      y: r.bottom + 4,
      ariaLabel: `${brand} menu`,
      items: [
        {
          label: `About ${brand}`,
          onSelect: () =>
            notify({
              title: brand,
              body: "An OS-style desktop, built with react-ui-os.",
              level: "info",
            }),
        },
        { separator: true },
        {
          label: "Settings…",
          shortcut: "⌘,",
          onSelect: () => {
            const payload = { kind: "system" as const, systemId: "settings" };
            openWindow(payload, pickInitialBounds(payload, theme, apps));
          },
        },
      ],
    });
  };

  return (
    <header
      data-rui-menubar=""
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: metrics.menuBarHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        backgroundColor: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        borderBottom: `1px solid ${theme.palette.border}`,
        color: theme.palette.textPrimary,
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: 12,
        zIndex: 10,
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={openBrandMenu}
          aria-haspopup="menu"
          aria-label={`${brand} menu`}
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            margin: 0,
            padding: "3px 7px",
            borderRadius: theme.shape.small,
            color: theme.palette.textPrimary,
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
            cursor: "pointer",
            transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${theme.palette.textPrimary}1a`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {brand}
        </button>
        {focusedName && (
          // macOS emphasizes the active app with a bold, full-contrast name.
          <span style={{ fontWeight: 600, color: theme.palette.textPrimary }}>
            {focusedName}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <WorkspaceIndicator />
        <StatusItems />
        <SystemClock
          color={theme.palette.textSecondary}
          accent={theme.palette.accent}
        />
      </div>
    </header>
  );
}

function StatusItems() {
  const items = useSyncExternalStore(
    subscribeStatusItems,
    listStatusItems,
    listStatusItems,
  );
  if (items.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Status tray"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      {items.map((item) => (
        <StatusItemView key={item.id} item={item} />
      ))}
    </div>
  );
}

function StatusItemView({ item }: { item: StatusItem }) {
  const theme = useTheme();
  const color = theme.palette.textSecondary;
  const accent = theme.palette.accent;
  // Theme-adaptive hover highlight (a translucent tint of the text color), so
  // it reads on light and dark menu bars alike. macOS shows a rounded highlight.
  const hover = `${theme.palette.textPrimary}1a`;
  const body = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        position: "relative",
        width: 18,
        height: 18,
      }}
    >
      {item.icon}
      {item.badge !== undefined && item.badge !== "" && item.badge !== 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -3,
            right: -5,
            minWidth: 12,
            height: 12,
            borderRadius: 6,
            background: accent,
            color: "#0d1226",
            fontSize: 9,
            fontWeight: 700,
            padding: "0 3px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {String(item.badge)}
        </span>
      )}
    </span>
  );
  const wrapped = (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!item.onClick}
      aria-label={item.tooltip ?? item.id}
      style={{
        appearance: "none",
        background: "transparent",
        border: 0,
        padding: "3px 5px",
        cursor: item.onClick ? "pointer" : "default",
        borderRadius: theme.shape.small,
        display: "inline-flex",
        color,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
      onMouseEnter={(e) => {
        if (!item.onClick) return;
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {body}
    </button>
  );
  if (!item.tooltip) return wrapped;
  return (
    <Tooltip text={item.tooltip} shortcut={item.shortcut} placement="bottom">
      {wrapped}
    </Tooltip>
  );
}

function WorkspaceIndicator() {
  const theme = useTheme();
  const { state, switchWorkspace } = useWindowManager();
  const workspaces = state.workspaces;
  const activeId = state.activeWorkspaceId;
  // Hide the indicator when there's only one workspace, no signal to give.
  if (workspaces.length <= 1) return null;
  return (
    <div
      role="tablist"
      aria-label="Workspaces"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 8,
      }}
    >
      {workspaces.map((id, idx) => {
        const isActive = id === activeId;
        return (
          <Tooltip
            key={id}
            text={`Workspace ${String(idx + 1)}`}
            shortcut={`⌃⌥${idx === 0 ? "1" : idx === workspaces.length - 1 ? String(workspaces.length) : String(idx + 1)}`}
            placement="bottom"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Workspace ${String(idx + 1)}`}
              onClick={() => switchWorkspace(id)}
              style={{
                appearance: "none",
                border: 0,
                background: "transparent",
                padding: 4,
                cursor: "pointer",
                borderRadius: 999,
                display: "inline-flex",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: isActive ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: isActive
                    ? theme.palette.accent
                    : theme.palette.textSecondary,
                  opacity: isActive ? 1 : 0.55,
                  transition: "width 140ms ease, opacity 140ms ease",
                }}
              />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function SystemClock({ color, accent }: { color: string; accent: string }) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}1a`;
  const { unreadCount } = useNotifications();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Set immediately on mount, then update every 30s. Guarding against the
    // SSR "rendered HH:MM != current HH:MM" hydration mismatch.
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  if (!now) return <span style={{ width: 92 }} aria-hidden />;
  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <Tooltip
      text={
        unreadCount > 0
          ? `${String(unreadCount)} unread notification${unreadCount === 1 ? "" : "s"}`
          : "Notification Center"
      }
      placement="bottom"
    >
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(NOTIFICATION_CENTER_TOGGLE_EVENT));
        }}
        aria-label={
          unreadCount > 0
            ? `${String(unreadCount)} unread notifications. Open Notification Center.`
            : "Open Notification Center"
        }
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          color,
          fontFamily: "inherit",
          fontSize: 12,
          padding: "3px 8px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: theme.shape.small,
          position: "relative",
          fontVariantNumeric: "tabular-nums",
          transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {unreadCount > 0 && (
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: accent,
            }}
          />
        )}
        {day} {time}
      </button>
    </Tooltip>
  );
}
