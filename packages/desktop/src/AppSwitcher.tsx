"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useWindowManager, windowIdOf, type App } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { pickInitialBounds } from "./util/initial-bounds";

/**
 * Cmd/Ctrl + Tab application switcher. Holds while the modifier is down,
 * cycles selection on Tab (and Shift+Tab to reverse), and activates the
 * focused app when the modifier is released. Esc cancels without
 * switching.
 *
 * MRU order comes from window z-index: the highest z is the most recent
 * focus, so the first Cmd+Tab selects the second entry (Mac convention).
 * Apps without any open window aren't included. The switcher targets
 * running apps, not the launcher.
 */
export function AppSwitcher() {
  const theme = useTheme();
  const apps = useApps();
  const { windows, focusWindow, openWindow, restoreWindow } = useWindowManager();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const candidates = useMemo<App[]>(() => {
    // Most-recently-focused first: sort the windows by z desc, then take
    // the first matching app per id. This makes Cmd+Tab "jump to last app"
    // when tapped once and released.
    const ordered = [...windows].sort((a, b) => b.z - a.z);
    const seen = new Set<string>();
    const list: App[] = [];
    for (const w of ordered) {
      if (w.payload.kind !== "app") continue;
      const { appId } = w.payload;
      if (seen.has(appId)) continue;
      seen.add(appId);
      const app = apps.find((a) => a.id === appId);
      if (app) list.push(app);
    }
    return list;
  }, [apps, windows]);

  // Activate the indexed app: bring its window to front (open if needed,
  // restore if minimized).
  const activate = useCallback(
    (idx: number) => {
      const target = candidates[idx];
      if (!target) return;
      const id = windowIdOf({ kind: "app", appId: target.id });
      const win = windows.find((w) => w.id === id);
      if (!win) {
        openWindow(
          { kind: "app", appId: target.id },
          pickInitialBounds({ kind: "app", appId: target.id }, theme, apps),
        );
      } else if (win.state === "minimized") {
        restoreWindow(id);
      } else {
        focusWindow(id);
      }
    },
    [apps, candidates, focusWindow, openWindow, restoreWindow, theme, windows],
  );

  // Modifier-state machine: open on Cmd/Ctrl+Tab, cycle on Tab, commit on
  // mod-up, cancel on Escape.
  useEffect(() => {
    const isMod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

    const handleDown = (e: KeyboardEvent) => {
      // Bail when typing in a field.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Tab" && isMod(e)) {
        e.preventDefault();
        if (candidates.length === 0) return;
        if (!open) {
          // First press: open and select the second entry (or the only one).
          setOpen(true);
          const startIdx = candidates.length > 1 ? 1 : 0;
          setIndex(e.shiftKey ? candidates.length - 1 : startIdx);
        } else {
          setIndex((prev) => {
            const dir = e.shiftKey ? -1 : 1;
            return (prev + dir + candidates.length) % candidates.length;
          });
        }
        return;
      }

      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };

    const handleUp = (e: KeyboardEvent) => {
      if (!open) return;
      // The switcher closes when the modifier itself is released. We do not
      // try to detect "user let go of all keys": that lets quick double-
      // tap Cmd+Tab cycles work the way every OS does it.
      if (e.key === "Meta" || e.key === "Control") {
        activate(index);
        setOpen(false);
      }
    };

    const handleBlur = () => {
      if (open) setOpen(false);
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [open, candidates, activate, index]);

  if (!open || candidates.length === 0) return null;

  return <Overlay theme={theme} candidates={candidates} index={index} />;
}

function Overlay({
  theme,
  candidates,
  index,
}: {
  theme: ReturnType<typeof useTheme>;
  candidates: App[];
  index: number;
}) {
  const surface: CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    minWidth: 240,
    maxWidth: "min(90vw, 720px)",
    background: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.windowRadius + 4,
    boxShadow: "0 24px 60px -10px rgba(0,0,0,0.6)",
    padding: 18,
    zIndex: 1500,
    fontFamily: "inherit",
    color: theme.palette.textPrimary,
  };

  const selected = candidates[index];

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          zIndex: 1490,
        }}
      />
      <div role="dialog" aria-label="Application switcher" style={surface}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {candidates.map((app, i) => (
            <Tile key={app.id} app={app} focused={i === index} theme={theme} />
          ))}
        </div>
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 500,
            color: theme.palette.textPrimary,
          }}
        >
          {selected?.name ?? ""}
        </div>
        <div
          style={{
            marginTop: 4,
            textAlign: "center",
            fontSize: 11,
            color: theme.palette.textSecondary,
          }}
        >
          Tab to cycle · Release to activate · Esc to cancel
        </div>
      </div>
    </>
  );
}

function Tile({
  app,
  focused,
  theme,
}: {
  app: App;
  focused: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const accent = app.accent ?? theme.palette.accent;
  const size = focused ? 72 : 56;
  const Art = app.iconArt;
  const Icon = app.icon;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: theme.shape.dockTileRadius,
        background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
        boxShadow: focused
          ? `0 0 0 3px ${accent}aa, 0 12px 24px rgba(0,0,0,0.45)`
          : "0 4px 10px rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        transition: "width 80ms ease, height 80ms ease, box-shadow 80ms ease",
      }}
      title={app.name}
    >
      {Art ? (
        <Art size={Math.round(size * 0.7)} />
      ) : Icon ? (
        <Icon size={Math.round(size * 0.5)} />
      ) : (
        <span
          style={{
            fontWeight: 700,
            fontSize: Math.round(size * 0.4),
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {app.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
