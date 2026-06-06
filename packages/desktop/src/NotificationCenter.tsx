"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  clearAllNotifications,
  markAllNotificationsRead,
  removeNotification,
  useNotifications,
  type NotificationItem,
} from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { NOTIFICATION_CENTER_TOGGLE_EVENT } from "./events";
import { getChromeMetrics } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";
import { useReducedMotion } from "./util/use-reduced-motion";

/**
 * Right-edge slide-in panel showing the full notification history.
 * Toggled by `NOTIFICATION_CENTER_TOGGLE_EVENT` (typically dispatched
 * when the user clicks the menu-bar clock) and dismissed by Esc, by
 * clicking the backdrop, or by re-firing the toggle event.
 *
 * Marks every visible item as read the first time it opens so the
 * unread badge clears the moment the user acknowledges them.
 */
export function NotificationCenter() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const apps = useApps();
  const { items, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    window.addEventListener(NOTIFICATION_CENTER_TOGGLE_EVENT, handleToggle);
    return () => {
      window.removeEventListener(NOTIFICATION_CENTER_TOGGLE_EVENT, handleToggle);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllNotificationsRead();
    }
  }, [open, unreadCount]);

  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const topGutter = theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0;

  const backdrop: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 1180,
    pointerEvents: open ? "auto" : "none",
  };

  const sheet: CSSProperties = {
    position: "fixed",
    top: topGutter,
    right: 0,
    bottom: 0,
    width: 360,
    maxWidth: "calc(100vw - 24px)",
    background: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    borderLeft: `1px solid ${theme.palette.border}`,
    color: theme.palette.textPrimary,
    boxShadow: "-20px 0 50px -20px rgba(0,0,0,0.55)",
    zIndex: 1200,
    transform: open ? "translateX(0)" : "translateX(100%)",
    // Under reduced motion the sheet appears and dismisses without sliding.
    transition: reducedMotion
      ? "none"
      : `transform ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}`,
    display: "flex",
    flexDirection: "column",
    fontFamily: "inherit",
  };

  const grouped = groupByDay(items);

  return (
    <>
      <div style={backdrop} aria-hidden={!open} onClick={() => setOpen(false)} />
      <aside
        style={sheet}
        aria-hidden={!open}
        aria-label="Notification Center"
        role="dialog"
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: `1px solid ${theme.palette.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <span style={{ color: theme.palette.textSecondary, fontSize: 11 }}>
              {items.length === 0
                ? "No notifications"
                : `${String(items.length)} total`}
            </span>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAllNotifications}
              style={{
                appearance: "none",
                background: "transparent",
                border: `1px solid ${theme.palette.border}`,
                color: theme.palette.textSecondary,
                borderRadius: theme.shape.small,
                fontSize: 11,
                padding: "3px 8px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Clear all
            </button>
          )}
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: items.length === 0 ? "32px 16px" : "12px 12px 24px",
          }}
        >
          {items.length === 0 ? (
            <EmptyState theme={theme} />
          ) : (
            grouped.map(([label, group]) => (
              <section key={label} style={{ marginBottom: 18 }}>
                <h3
                  style={{
                    margin: "0 6px 6px",
                    fontSize: 10,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: theme.palette.textSecondary,
                    fontWeight: 600,
                  }}
                >
                  {label}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.map((item) => (
                    <CenterRow
                      key={item.id}
                      item={item}
                      accent={accentFor(item, apps)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function EmptyState({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <div
      style={{
        textAlign: "center",
        color: theme.palette.textSecondary,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: theme.palette.border,
          margin: "0 auto 10px",
          display: "grid",
          placeItems: "center",
          color: theme.palette.textPrimary,
          fontSize: 22,
          fontWeight: 200,
        }}
      >
        ·
      </div>
      You are all caught up.
      <br />
      Toasts will collect here while you work.
    </div>
  );
}

function CenterRow({ item, accent }: { item: NotificationItem; accent: string }) {
  const theme = useTheme();
  const time = new Date(item.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      style={{
        position: "relative",
        background: theme.palette.border,
        borderRadius: theme.shape.small + 2,
        padding: "10px 12px 10px 16px",
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 3,
          background: accent,
          borderRadius: 3,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <strong style={{ fontSize: 12 }}>{item.title}</strong>
        <span
          style={{
            color: theme.palette.textSecondary,
            fontSize: 10,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {time}
        </span>
      </div>
      {(item.body || item.bodyNode) && (
        <div
          style={{
            marginTop: 2,
            color: theme.palette.textSecondary,
          }}
        >
          {item.bodyNode ?? item.body}
        </div>
      )}
      <button
        type="button"
        onClick={() => removeNotification(item.id)}
        aria-label="Remove notification"
        style={{
          position: "absolute",
          top: 4,
          right: 6,
          appearance: "none",
          background: "transparent",
          border: 0,
          color: theme.palette.textSecondary,
          padding: 4,
          fontSize: 11,
          cursor: "pointer",
          opacity: 0.5,
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.5";
        }}
      >
        ×
      </button>
    </div>
  );
}

function accentFor(item: NotificationItem, apps: ReturnType<typeof useApps>): string {
  if (item.accent) return item.accent;
  if (item.appId) {
    const app = apps.find((a) => a.id === item.appId);
    if (app?.accent) return app.accent;
  }
  if (item.level === "success") return "#22c55e";
  if (item.level === "warn") return "#f59e0b";
  if (item.level === "error") return "#ef4444";
  return "#6b8afd";
}

function groupByDay(items: NotificationItem[]): Array<[string, NotificationItem[]]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, NotificationItem[]> = {};
  for (const item of items) {
    const date = new Date(item.createdAt);
    date.setHours(0, 0, 0, 0);
    const label =
      date.getTime() === today.getTime()
        ? "Today"
        : date.getTime() === yesterday.getTime()
          ? "Yesterday"
          : new Date(item.createdAt).toLocaleDateString();
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return Object.entries(groups);
}
