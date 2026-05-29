"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useWindowManager, type OpenWindow } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { getSystemWindow, resolveSystemWindowName } from "./system-windows";

/**
 * Mission Control: press F3 (or Ctrl+Up on non-Mac keyboards) and every
 * open window animates into a tiled grid of large preview cards. Click a
 * card to dismiss and focus that window; click empty space or hit Esc to
 * dismiss without switching. Mirrors the macOS gesture in everything but
 * the live thumbnail. Instead of mirroring the window's body, the card
 * shows the chrome and a neutral body fill so the user can pick by
 * shape and name at a glance.
 *
 * Self-mounted by `<Desktop>`. Drop down to `<DesktopProvider>` and skip
 * it if you want to replace it.
 */
export function MissionControl() {
  const theme = useTheme();
  const apps = useApps();
  const { windows, focusWindow, restoreWindow } = useWindowManager();

  const [open, setOpen] = useState(false);

  // Only count windows that are actually visible (not minimized). Mission
  // Control's job is to surface what's on screen, not what's parked in the
  // dock.
  const visible = useMemo<OpenWindow[]>(
    () => windows.filter((w) => w.state !== "minimized"),
    [windows],
  );

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      // Ctrl + ArrowUp, Mac convention for Mission Control on PCs.
      if (e.ctrlKey && !e.metaKey && e.key === "ArrowUp") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleDown);
    return () => {
      window.removeEventListener("keydown", handleDown);
    };
  }, [open]);

  const handlePick = useCallback(
    (win: OpenWindow) => {
      if (win.state === "minimized") restoreWindow(win.id);
      else focusWindow(win.id);
      setOpen(false);
    },
    [focusWindow, restoreWindow],
  );

  if (!open) return null;

  if (visible.length === 0) {
    return (
      <Overlay theme={theme} onDismiss={() => setOpen(false)}>
        <EmptyState theme={theme} />
      </Overlay>
    );
  }

  return (
    <Overlay theme={theme} onDismiss={() => setOpen(false)}>
      <Grid
        windows={visible}
        onPick={handlePick}
        labelFor={(w) => labelFor(w, apps)}
        accentFor={(w) => accentFor(w, apps)}
      />
    </Overlay>
  );
}

function Overlay({
  theme,
  onDismiss,
  children,
}: {
  theme: ReturnType<typeof useTheme>;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const wrap: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    zIndex: 1450,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Responsive padding: 48 px on a desktop, down to 16 px in a docs
    // iframe so the grid actually has room to breathe instead of being
    // squeezed by a quarter of the viewport on each side.
    padding: "clamp(16px, 5vmin, 48px)",
    boxSizing: "border-box",
  };
  return (
    <div
      role="dialog"
      aria-label="Mission Control"
      style={wrap}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <div
      style={{
        color: theme.palette.textPrimary,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          fontSize: 24,
          opacity: 0.7,
          marginBottom: 6,
        }}
      >
        Nothing to show
      </div>
      <div style={{ color: theme.palette.textSecondary, fontSize: 12 }}>
        Open an app first, then press F3 to see them all at once.
      </div>
    </div>
  );
}

function Grid({
  windows,
  onPick,
  labelFor,
  accentFor,
}: {
  windows: OpenWindow[];
  onPick: (win: OpenWindow) => void;
  labelFor: (win: OpenWindow) => string;
  accentFor: (win: OpenWindow) => string;
}) {
  const theme = useTheme();
  // Auto-fit so the grid finds the right column count on its own: cards
  // never narrower than 180 px, never wider than 320 px. That avoids the
  // ugly 2+1 layout 3 windows used to produce, and stops single cards
  // from sprawling to fill 800 px just because there's room.
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), max-content))",
        justifyContent: "center",
        gap: "clamp(8px, 1.5vmin, 18px)",
        maxWidth: "min(1100px, 100%)",
        width: "100%",
      }}
    >
      {windows.map((win) => (
        <Card
          key={win.id}
          win={win}
          label={labelFor(win)}
          accent={accentFor(win)}
          onPick={() => onPick(win)}
          theme={theme}
        />
      ))}
    </div>
  );
}

function Card({
  win,
  label,
  accent,
  onPick,
  theme,
}: {
  win: OpenWindow;
  label: string;
  accent: string;
  onPick: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  // Card aspect mirrors the window's aspect, so a tall window reads tall
  // in the grid. Clamped to a sensible range so a 320×360 utility doesn't
  // dominate next to a 1000×700 doc. Width is capped so a single card
  // never sprawls to fill the whole modal.
  const ratio = clampRatio(win.w / Math.max(win.h, 1));
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        appearance: "none",
        border: `1px solid ${theme.palette.border}`,
        background: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        borderRadius: theme.shape.windowRadius,
        padding: 0,
        cursor: "pointer",
        color: theme.palette.textPrimary,
        textAlign: "left",
        fontFamily: "inherit",
        width: "min(280px, 100%)",
        overflow: "hidden",
        position: "relative",
        aspectRatio: `${String(ratio)} / 1`,
        boxShadow: "0 12px 28px -6px rgba(0,0,0,0.45)",
        transition: "transform 80ms ease, box-shadow 80ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.03)";
        e.currentTarget.style.boxShadow = `0 16px 36px -6px rgba(0,0,0,0.55), 0 0 0 2px ${accent}aa`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 12px 28px -6px rgba(0,0,0,0.45)";
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 4,
          background: accent,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: `1px solid ${theme.palette.border}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        <TrafficLights />
      </div>
      <div
        style={{
          padding: 14,
          color: theme.palette.textSecondary,
          fontSize: 11,
          height: "100%",
        }}
      >
        <div style={{ opacity: 0.6, marginBottom: 6 }}>
          {String(Math.round(win.w))} × {String(Math.round(win.h))}
        </div>
        <WindowBodyFill theme={theme} />
      </div>
    </button>
  );
}

function TrafficLights() {
  const dots = ["#ff5f57", "#febc2e", "#28c840"];
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 4 }}>
      {dots.map((color) => (
        <span
          key={color}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
      ))}
    </span>
  );
}

function WindowBodyFill({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <div
      aria-hidden
      style={{
        height: "calc(100% - 28px)",
        borderRadius: theme.shape.small,
        background: theme.palette.background,
        border: `1px solid ${theme.palette.border}`,
      }}
    />
  );
}

function clampRatio(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 4 / 3;
  if (r > 2.4) return 2.4;
  if (r < 0.7) return 0.7;
  return r;
}

function labelFor(win: OpenWindow, apps: ReturnType<typeof useApps>): string {
  const p = win.payload;
  if (p.kind === "app") {
    return apps.find((a) => a.id === p.appId)?.name ?? p.appId;
  }
  const def = getSystemWindow(p.systemId);
  return def ? resolveSystemWindowName(def, p.args) : p.systemId;
}

function accentFor(win: OpenWindow, apps: ReturnType<typeof useApps>): string {
  const p = win.payload;
  if (p.kind === "app") {
    const app = apps.find((a) => a.id === p.appId);
    return app?.accent ?? "#6b8afd";
  }
  const def = getSystemWindow(p.systemId);
  return def?.accent ?? "#6b8afd";
}
