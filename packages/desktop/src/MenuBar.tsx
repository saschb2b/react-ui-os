"use client";

import { useEffect, useState } from "react";
import { useWindowManager } from "@react-ui-os/core";
import { useApp, useTheme } from "./desktop-context";
import { getSystemWindow } from "./system-windows";
import { MENU_BAR_HEIGHT } from "./util/layout";

export { MENU_BAR_HEIGHT };

/**
 * System chrome at the top of the desktop. Left: brand. Center-right: the
 * focused app's name. Right: a small status cluster (live clock). Returns
 * null when `theme.chrome.menuBar` is "none".
 */
export function MenuBar({ brand = "react-ui-os" }: { brand?: string }) {
  const theme = useTheme();
  const { focusedWindow } = useWindowManager();
  const focusedApp = useApp(
    focusedWindow?.payload.kind === "app"
      ? focusedWindow.payload.appId
      : "__none__",
  );
  const focusedSystem =
    focusedWindow?.payload.kind === "system"
      ? getSystemWindow(focusedWindow.payload.systemId)
      : undefined;
  const focusedName = focusedApp?.name ?? focusedSystem?.name;

  if (theme.chrome.menuBar !== "top") return null;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: MENU_BAR_HEIGHT,
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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ letterSpacing: 0.2 }}>{brand}</strong>
        {focusedName && (
          <span
            style={{
              color: theme.palette.textSecondary,
              borderLeft: `1px solid ${theme.palette.border}`,
              paddingLeft: 8,
            }}
          >
            {focusedName}
          </span>
        )}
      </div>
      <SystemClock color={theme.palette.textSecondary} />
    </header>
  );
}

function SystemClock({ color }: { color: string }) {
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
    <span style={{ color, fontVariantNumeric: "tabular-nums" }}>
      {day} {time}
    </span>
  );
}
