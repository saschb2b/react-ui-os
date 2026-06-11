"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  dismissNotification,
  markNotificationRead,
  useNotifications,
  type NotificationItem,
} from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { getChromeMetrics, getDockReservation } from "./util/layout";
import { useReducedMotion } from "./util/use-reduced-motion";
import { useViewportMode } from "./util/viewport-mode";

/**
 * Top-right stack of active toasts. Each toast slides in from the right
 * edge, sits, then slides out when its `duration` elapses or the user
 * dismisses it. The component is purely a viewer of the module-level
 * notification store; it does not own any of the truth.
 *
 * Self-mounted by `<Desktop>` so the consumer does not have to think
 * about where to put it.
 */
export function NotificationToasts() {
  const theme = useTheme();
  const apps = useApps();
  const { active } = useNotifications();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  // The stack clears the menu bar and any dock edge it would otherwise cover
  // (a top or right taskbar reserves its strip here).
  const dock = getDockReservation(theme);
  const dockGutter =
    (theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0) + dock.top + 12;

  if (active.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: "fixed",
        top: dockGutter,
        right: dock.right + 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 1300,
        pointerEvents: "none",
        maxWidth: 380,
        width: "calc(100vw - 24px)",
      }}
    >
      {active.map((item, idx) => {
        const accent =
          item.accent ??
          (item.appId ? apps.find((a) => a.id === item.appId)?.accent : undefined) ??
          levelAccent(item.level) ??
          theme.palette.accent;
        return <Toast key={item.id} item={item} accent={accent} indexFromTop={idx} />;
      })}
    </div>
  );
}

function levelAccent(level: NotificationItem["level"]): string | undefined {
  switch (level) {
    case "success":
      return "#22c55e";
    case "warn":
      return "#f59e0b";
    case "error":
      return "#ef4444";
    default:
      return undefined;
  }
}

function Toast({
  item,
  accent,
  indexFromTop,
}: {
  item: NotificationItem;
  accent: string;
  indexFromTop: number;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"enter" | "ready">("enter");
  const enterDelay = Math.min(indexFromTop, 4) * 40;

  useEffect(() => {
    // Two-frame trick: ensure the initial style is committed before we
    // flip phase, so the transition runs cleanly even on the very first
    // mount.
    const raf = window.requestAnimationFrame(() => {
      window.setTimeout(() => setPhase("ready"), enterDelay);
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [enterDelay]);

  // Mark as read 1.5s into the toast lifecycle so the badge clears even
  // if the user never opens the Center. Errors don't clear automatically.
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (item.level === "error" || item.read) return;
    readTimerRef.current = setTimeout(() => {
      markNotificationRead(item.id);
    }, 1500);
    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, [item.id, item.level, item.read]);

  // Under reduced motion the toast appears in place (no slide-in) and the
  // transition below is dropped, so it never travels across the screen.
  const baseTransform = reducedMotion
    ? "none"
    : phase === "enter"
      ? "translateX(120%) scale(0.96)"
      : "translateX(0) scale(1)";
  const baseOpacity = phase === "enter" ? 0 : 1;

  const card: CSSProperties = {
    pointerEvents: "auto",
    background: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.windowRadius,
    boxShadow: "0 18px 48px -16px rgba(0,0,0,0.55)",
    color: theme.palette.textPrimary,
    padding: "12px 14px 12px 18px",
    position: "relative",
    overflow: "hidden",
    transform: baseTransform,
    opacity: baseOpacity,
    transition: reducedMotion
      ? "none"
      : `transform ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}, opacity ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}`,
  };

  const accentBar: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: accent,
  };

  return (
    <div style={card} role="status">
      <span style={accentBar} aria-hidden />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ToastIcon item={item} accent={accent} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {item.title}
          </div>
          {(item.body || item.bodyNode) && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                lineHeight: 1.4,
                color: theme.palette.textSecondary,
                wordBreak: "break-word",
              }}
            >
              {item.bodyNode ?? item.body}
            </div>
          )}
          {item.actions && item.actions.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {item.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    action.onClick(item.id);
                    dismissNotification(item.id);
                  }}
                  style={{
                    appearance: "none",
                    border: action.primary
                      ? "1px solid transparent"
                      : `1px solid ${theme.palette.border}`,
                    background: action.primary ? accent : "transparent",
                    color: action.primary ? "#fff" : theme.palette.textPrimary,
                    borderRadius: theme.shape.small,
                    fontSize: 12,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: action.primary ? 600 : 500,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <DismissButton
          onClick={() => dismissNotification(item.id)}
          color={theme.palette.textSecondary}
        />
      </div>
    </div>
  );
}

function ToastIcon({ item, accent }: { item: NotificationItem; accent: string }) {
  const theme = useTheme();
  const IconComp = item.icon;
  const content: ReactNode = IconComp ? (
    <IconComp size={16} />
  ) : (
    <span style={{ fontSize: 12, fontWeight: 700 }}>{iconLetterFor(item)}</span>
  );
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: theme.shape.small + 2,
        background: `${accent}1f`,
        border: `1px solid ${theme.palette.border}`,
        color: theme.palette.textPrimary,
        display: "grid",
        placeItems: "center",
        marginTop: 1,
      }}
    >
      {content}
    </div>
  );
}

function iconLetterFor(item: NotificationItem): string {
  if (item.level === "error") return "!";
  if (item.level === "warn") return "!";
  if (item.level === "success") return "✓";
  if (item.title) return item.title.trim().charAt(0).toUpperCase();
  return "·";
}

function DismissButton({ onClick, color }: { onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss notification"
      style={{
        appearance: "none",
        background: "transparent",
        border: 0,
        color,
        padding: 2,
        cursor: "pointer",
        opacity: 0.6,
        fontSize: 14,
        lineHeight: 1,
        marginTop: -2,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.6";
      }}
    >
      ×
    </button>
  );
}
