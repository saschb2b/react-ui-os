"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { notify, useWindowManager } from "@react-ui-os/core";
import { useApps, useTheme } from "../desktop-context";
import { resolveAppIcon } from "../util/app-icon";
import { getDockReservation } from "../util/layout";
import { nextCascadeIndex, pickInitialBounds } from "../util/initial-bounds";
import { useReducedMotion } from "../util/use-reduced-motion";
import { useSurfaceTransition } from "../util/use-surface-transition";
import { useLauncher, type LauncherResult, type LauncherState } from "./use-launcher";

/**
 * The app launcher. Always mounted by `<Desktop>`; it owns its open/close state
 * and the Cmd/Ctrl+K shortcut through `useLauncher`, and renders the
 * presentation named by `theme.chrome.launcher`:
 *
 *   "spotlight" (default)  macOS centered command palette
 *   "grid"                 GNOME Activities app-grid overview
 *   "menu"                 Windows Start menu
 *
 * All three are thin views over the same hook, so a custom launcher is the
 * same hook plus your own markup.
 */
export function Launcher() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const launcher = useLauncher();
  // The same open/close transition every surface shares: grow in, and shrink
  // out instead of vanishing. Stays mounted through the close animation.
  const { mounted, surfaceStyle } = useSurfaceTransition(launcher.open, {
    durationMs: reducedMotion ? 0 : theme.motion.windowOpenDurationMs,
    easing: theme.motion.windowOpenEasing,
  });
  if (!mounted) return null;
  switch (theme.chrome.launcher) {
    case "grid":
      return <GridView launcher={launcher} surfaceStyle={surfaceStyle} />;
    case "menu":
      return <MenuView launcher={launcher} surfaceStyle={surfaceStyle} />;
    default:
      return <SpotlightView launcher={launcher} surfaceStyle={surfaceStyle} />;
  }
}

/* ─── Spotlight (macOS) ─────────────────────────────────────────── */

// Stable ids wiring the input (an editable combobox) to its listbox popup
// per the WAI-ARIA combobox pattern, so screen readers announce the active
// option as the user arrows through results. Only one launcher is mounted at
// a time, so module-constant ids are safe.
// https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
const SPOTLIGHT_LISTBOX_ID = "rui-spotlight-listbox";
function spotlightOptionId(index: number): string {
  return `rui-spotlight-option-${String(index)}`;
}

function SpotlightView({
  launcher,
  surfaceStyle,
}: {
  launcher: LauncherState;
  surfaceStyle: CSSProperties;
}) {
  const theme = useTheme();
  const { query, setQuery, results, selectedIndex, setSelectedIndex } = launcher;
  const { moveSelection, activate, activateSelected, close } = launcher;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-spotlight-index="${String(selectedIndex)}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handlePaletteKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      // The palette is a modal (aria-modal). The search input is its only
      // focusable element, so trap Tab and Shift+Tab on it rather than
      // letting focus escape to the desktop behind the overlay.
      e.preventDefault();
      inputRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      moveSelection(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      moveSelection(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      activateSelected();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        backdropFilter: theme.blur.spotlight,
        WebkitBackdropFilter: theme.blur.spotlight,
        backgroundColor: "rgba(0,0,0,0.32)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "14vh",
        ...surfaceStyle,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Spotlight"
        onKeyDown={handlePaletteKey}
        style={{
          width: "min(640px, calc(100vw - 32px))",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          backgroundColor: theme.palette.surface,
          backdropFilter: theme.blur.spotlight,
          WebkitBackdropFilter: theme.blur.spotlight,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: theme.shape.windowRadius + 4,
          color: theme.palette.textPrimary,
          boxShadow:
            "0 40px 90px -22px rgba(0,0,0,0.75), 0 10px 28px -8px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            height: 56,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            borderBottom: `1px solid ${theme.palette.border}`,
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search apps and commands"
            aria-autocomplete="list"
            aria-controls={SPOTLIGHT_LISTBOX_ID}
            aria-expanded={results.length > 0}
            aria-activedescendant={
              results.length > 0 ? spotlightOptionId(selectedIndex) : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search apps..."
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              color: theme.palette.textPrimary,
              fontFamily: "inherit",
              fontSize: 16,
            }}
          />
        </div>

        <div
          ref={listRef}
          id={SPOTLIGHT_LISTBOX_ID}
          role="listbox"
          aria-label="Spotlight results"
          style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 0" }}
        >
          {results.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            results.map((result, i) => (
              <ResultRow
                key={result.key}
                result={result}
                index={i}
                selected={i === selectedIndex}
                onHover={() => {
                  setSelectedIndex(i);
                }}
                onActivate={() => {
                  activate(result);
                }}
              />
            ))
          )}
        </div>

        <div
          style={{
            height: 28,
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            borderTop: `1px solid ${theme.palette.border}`,
            flexShrink: 0,
            color: theme.palette.textSecondary,
            fontSize: 11,
          }}
        >
          <HintChip keys="↑↓" label="Navigate" />
          <HintChip keys="↵" label="Open" />
          <HintChip keys="Esc" label="Close" />
        </div>
      </div>
    </div>
  );
}

/* ─── App grid (GNOME) ──────────────────────────────────────────── */

const GRID_LISTBOX_ID = "rui-launcher-grid";
const GRID_COLUMNS = 6;
function gridOptionId(index: number): string {
  return `rui-launcher-grid-option-${String(index)}`;
}

/**
 * GNOME Activities overview: a full-bleed search field over a centered grid of
 * large app icons. Typing filters; the grid carries the same results the
 * spotlight list does (apps, system windows, sources). Focus stays in the
 * search field while the arrow keys move a visual selection across the grid,
 * the GNOME behavior.
 */
function GridView({
  launcher,
  surfaceStyle,
}: {
  launcher: LauncherState;
  surfaceStyle: CSSProperties;
}) {
  const theme = useTheme();
  const { query, setQuery, results, selectedIndex, setSelectedIndex } = launcher;
  const { moveSelection, activate, activateSelected, close } = launcher;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveSelection(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveSelection(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveSelection(GRID_COLUMNS);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveSelection(-GRID_COLUMNS);
        break;
      case "Enter":
        e.preventDefault();
        activateSelected();
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={onKey}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        backdropFilter: theme.blur.spotlight,
        WebkitBackdropFilter: theme.blur.spotlight,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "11vh",
        gap: 40,
        ...surfaceStyle,
      }}
    >
      <input
        ref={inputRef}
        role="combobox"
        aria-label="Search applications"
        aria-autocomplete="list"
        aria-controls={GRID_LISTBOX_ID}
        aria-expanded={results.length > 0}
        aria-activedescendant={
          results.length > 0 ? gridOptionId(selectedIndex) : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        placeholder="Type to search"
        style={{
          width: "min(420px, calc(100vw - 64px))",
          height: 44,
          padding: "0 18px",
          textAlign: "center",
          border: `1px solid ${theme.palette.border}`,
          borderRadius: 999,
          outline: "none",
          background: theme.palette.surface,
          backdropFilter: theme.blur.spotlight,
          WebkitBackdropFilter: theme.blur.spotlight,
          color: theme.palette.textPrimary,
          fontFamily: "inherit",
          fontSize: 15,
          flexShrink: 0,
        }}
      />
      <div
        id={GRID_LISTBOX_ID}
        role="listbox"
        aria-label="Applications"
        style={{
          width: "min(840px, calc(100vw - 64px))",
          maxHeight: "62vh",
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: `repeat(${String(GRID_COLUMNS)}, 1fr)`,
          gap: 24,
          padding: 8,
          justifyItems: "center",
        }}
      >
        {results.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: theme.palette.textSecondary,
              fontSize: 14,
              padding: "24px 0",
            }}
          >
            {query.trim().length > 0
              ? `No matches for "${query.trim()}".`
              : "No applications."}
          </div>
        ) : (
          results.map((result, i) => (
            <LauncherTile
              key={result.key}
              result={result}
              index={i}
              selected={i === selectedIndex}
              onHover={() => {
                setSelectedIndex(i);
              }}
              onActivate={() => {
                activate(result);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LauncherTile({
  result,
  index,
  selected,
  onHover,
  onActivate,
  size = 72,
  optionId = gridOptionId,
}: {
  result: LauncherResult;
  index: number;
  selected: boolean;
  onHover: () => void;
  onActivate: () => void;
  size?: number;
  optionId?: (index: number) => string;
}) {
  const theme = useTheme();
  const accent = result.accent ?? theme.palette.accent;
  const Art = result.kind === "app" ? result.app.iconArt : undefined;
  const Icon =
    result.kind === "app"
      ? resolveAppIcon(result.app, theme)
      : result.kind === "system"
        ? resolveAppIcon(result.def, theme)
        : undefined;
  const externalIcon = result.kind === "external" ? result.icon : undefined;
  const tile = size;
  return (
    <div
      id={optionId(index)}
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onActivate}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "12px 6px",
        borderRadius: theme.shape.windowRadius,
        cursor: "pointer",
        background: selected ? `${theme.palette.textPrimary}1f` : "transparent",
        transition: "background 100ms ease",
      }}
    >
      <div
        style={{
          width: tile,
          height: tile,
          borderRadius: theme.shape.dockTileRadius,
          background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {Art ? (
          <Art size={Math.round(tile * 0.7)} />
        ) : Icon ? (
          <Icon size={Math.round(tile * 0.46)} />
        ) : externalIcon ? (
          externalIcon
        ) : (
          <span style={{ fontWeight: 700, fontSize: Math.round(tile * 0.4) }}>
            {result.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span
        style={{
          maxWidth: "100%",
          fontSize: 12,
          textAlign: "center",
          color: theme.palette.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {result.name}
      </span>
    </div>
  );
}

/* ─── Start menu (Windows) ──────────────────────────────────────── */

const MENU_LISTBOX_ID = "rui-launcher-menu";
// Windows 11's Start menu pins six icons per row in a fixed-width floating
// panel (the classic 100%-scale size is ~640px wide).
// Source: https://www.neowin.net/guides/how-to-resize-the-start-menu-in-windows-11/
const MENU_COLUMNS = 6;
const MENU_WIDTH = 600;
function menuOptionId(index: number): string {
  return `rui-launcher-menu-option-${String(index)}`;
}

/**
 * Windows Start menu: a panel anchored just past the dock launcher, with a
 * search field above a grid of app tiles. Filters as you type; arrow keys move
 * a visual selection across the grid. Anchored and animated from the dock edge
 * (bottom-left for a bottom taskbar, beside a left dock).
 */
function MenuView({
  launcher,
  surfaceStyle,
}: {
  launcher: LauncherState;
  surfaceStyle: CSSProperties;
}) {
  const theme = useTheme();
  const apps = useApps();
  const { state, openWindow, windows } = useWindowManager();
  const { query, setQuery, results, selectedIndex, setSelectedIndex } = launcher;
  const { moveSelection, activate, activateSelected, close } = launcher;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showAllApps, setShowAllApps] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  const searching = query.trim().length > 0;
  // The listbox is a grid in the pinned / search views and a single column in
  // the All apps list, so vertical arrows step by the right amount.
  const cols = showAllApps ? 1 : MENU_COLUMNS;
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveSelection(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveSelection(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveSelection(cols);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveSelection(-cols);
        break;
      case "Enter":
        e.preventDefault();
        activateSelected();
        break;
      case "Escape":
        e.preventDefault();
        if (showAllApps) setShowAllApps(false);
        else close();
        break;
      default:
        break;
    }
  };

  // Recommended mirrors Windows 11's "recently added and frequently used":
  // the apps with open windows, most-recently-focused first (window z is the
  // recency order the manager already maintains).
  const zByApp = new Map<string, number>();
  for (const w of windows) {
    if (w.payload.kind === "app") {
      zByApp.set(w.payload.appId, Math.max(zByApp.get(w.payload.appId) ?? 0, w.z));
    }
  }
  const recommended = results
    .filter((r) => r.kind === "app" && zByApp.has(r.app.id))
    .sort((a, b) => {
      const za = a.kind === "app" ? (zByApp.get(a.app.id) ?? 0) : 0;
      const zb = b.kind === "app" ? (zByApp.get(b.app.id) ?? 0) : 0;
      return zb - za;
    })
    .slice(0, 4);

  const openSettings = () => {
    const payload = { kind: "system" as const, systemId: "settings" };
    openWindow(
      payload,
      pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
    );
    close();
  };

  // Raise Start from its launcher button, not a fixed corner: Windows 11 opens
  // the menu above the Start button (so it tracks a centered or left-aligned
  // taskbar) rather than centering a modal the way Spotlight does. Read the
  // button's live rect and clamp the panel into the viewport.
  const reservation = getDockReservation(theme);
  const gap = 8;
  const onLeft = theme.chrome.dockPosition === "left";
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const btn =
    typeof document === "undefined"
      ? null
      : (document
          .querySelector('[data-rui-dock] [aria-label="Open launcher"]')
          ?.getBoundingClientRect() ?? null);
  const width = Math.min(MENU_WIDTH, vw - 2 * gap);
  let anchor: CSSProperties;
  let menuOrigin: string;
  let available: number;
  if (onLeft) {
    // Beside the left dock, dropping down from the launcher button.
    const top = btn ? Math.max(gap, Math.min(btn.top, vh - gap - 220)) : gap;
    anchor = { left: reservation.left + gap, top };
    menuOrigin = "top left";
    available = vh - top - gap;
  } else {
    // Above the bottom taskbar, horizontally centered on the launcher button.
    const centerX = btn ? btn.left + btn.width / 2 : vw / 2;
    const left = Math.max(gap, Math.min(centerX - width / 2, vw - width - gap));
    anchor = { left, bottom: reservation.bottom + gap };
    menuOrigin = `${String(Math.round(centerX - left))}px 100%`;
    available = vh - reservation.bottom - 2 * gap;
  }
  // A tall, fixed panel like the Windows 11 menu (which keeps its size and lets
  // the pinned grid breathe), clamped to the viewport on short screens.
  const height = Math.min(600, available);

  const listbox = (
    <div
      id={MENU_LISTBOX_ID}
      role="listbox"
      aria-label={showAllApps ? "All apps" : "Apps"}
      style={{
        ...(showAllApps
          ? { display: "flex", flexDirection: "column", gap: 2 }
          : {
              display: "grid",
              gridTemplateColumns: `repeat(${String(MENU_COLUMNS)}, 1fr)`,
              gap: 4,
              justifyItems: "center",
              alignContent: "start",
            }),
      }}
    >
      {results.length === 0 ? (
        <div
          style={{
            gridColumn: "1 / -1",
            textAlign: "center",
            color: theme.palette.textSecondary,
            fontSize: 13,
            padding: "20px 0",
          }}
        >
          {searching ? `No matches for "${query.trim()}".` : "No apps."}
        </div>
      ) : showAllApps ? (
        results.map((result, i) => (
          <MenuRow
            key={result.key}
            result={result}
            index={i}
            optionId={menuOptionId}
            selected={i === selectedIndex}
            onHover={() => {
              setSelectedIndex(i);
            }}
            onActivate={() => {
              activate(result);
            }}
          />
        ))
      ) : (
        results.map((result, i) => (
          <LauncherTile
            key={result.key}
            result={result}
            index={i}
            size={40}
            optionId={menuOptionId}
            selected={i === selectedIndex}
            onHover={() => {
              setSelectedIndex(i);
            }}
            onActivate={() => {
              activate(result);
            }}
          />
        ))
      )}
    </div>
  );

  return (
    <>
      <div
        role="presentation"
        onClick={close}
        style={{ position: "fixed", inset: 0, zIndex: 1399 }}
      />
      <div
        role="dialog"
        aria-label="Start"
        onKeyDown={onKey}
        style={{
          position: "fixed",
          ...anchor,
          width,
          height,
          zIndex: 1400,
          display: "flex",
          flexDirection: "column",
          background: theme.palette.surface,
          backdropFilter: theme.blur.spotlight,
          WebkitBackdropFilter: theme.blur.spotlight,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: theme.shape.windowRadius,
          color: theme.palette.textPrimary,
          boxShadow:
            theme.elevation?.windowFocused ?? "0 24px 60px -16px rgba(0,0,0,0.6)",
          overflow: "hidden",
          transformOrigin: menuOrigin,
          ...surfaceStyle,
        }}
      >
        <div style={{ position: "relative", flexShrink: 0, padding: "16px 20px 8px" }}>
          <svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            style={{
              position: "absolute",
              left: 32,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: theme.palette.textSecondary,
            }}
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <line
              x1="10.4"
              y1="10.4"
              x2="14"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search for apps"
            aria-autocomplete="list"
            aria-controls={MENU_LISTBOX_ID}
            aria-expanded={results.length > 0}
            aria-activedescendant={
              results.length > 0 ? menuOptionId(selectedIndex) : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAllApps(false);
            }}
            placeholder="Search for apps, settings, and documents"
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: 36,
              padding: "0 14px 0 36px",
              border: `1px solid ${theme.palette.border}`,
              borderRadius: 18,
              outline: "none",
              background: theme.palette.background,
              color: theme.palette.textPrimary,
              fontFamily: "inherit",
              fontSize: 13,
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "4px 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <MenuSectionHeader
            label={searching ? "Results" : showAllApps ? "All apps" : "Pinned"}
            action={
              searching
                ? undefined
                : showAllApps
                  ? { label: "Back", onClick: () => setShowAllApps(false), back: true }
                  : { label: "All apps", onClick: () => setShowAllApps(true) }
            }
          />
          {listbox}

          {!searching && !showAllApps && recommended.length > 0 ? (
            <>
              <div style={{ height: 6 }} />
              <MenuSectionHeader label="Recommended" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                }}
              >
                {recommended.map((result) => (
                  <MenuRow
                    key={`rec:${result.key}`}
                    result={result}
                    subtitle="Recently used"
                    onActivate={() => {
                      activate(result);
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            borderTop: `1px solid ${theme.palette.border}`,
            background: `${theme.palette.textPrimary}08`,
          }}
        >
          <MenuFooterButton aria-label="Account" onClick={openSettings}>
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: theme.palette.accent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="5" r="3" />
                <path d="M2.5 14a5.5 5.5 0 0 1 11 0z" />
              </svg>
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>User</span>
          </MenuFooterButton>
          <PowerButton onAction={close} />
        </div>
      </div>
    </>
  );
}

/** A "Pinned" / "Recommended" header row with an optional trailing action. */
function MenuSectionHeader({
  label,
  action,
}: {
  label: string;
  action?: { label: string; onClick: () => void; back?: boolean };
}) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}14`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <span
        style={{ fontSize: 13, fontWeight: 600, color: theme.palette.textPrimary }}
      >
        {label}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: "none",
            background: "transparent",
            color: theme.palette.textSecondary,
            cursor: "pointer",
            borderRadius: theme.shape.small,
            padding: "4px 8px",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          {action.back ? "‹ " : null}
          {action.label}
          {action.back ? null : " ›"}
        </button>
      ) : null}
    </div>
  );
}

/** The footer account chip: an icon-plus-label button. */
function MenuFooterButton({
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  "aria-label": string;
}) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}14`;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        border: "none",
        background: "transparent",
        color: theme.palette.textPrimary,
        cursor: "pointer",
        borderRadius: theme.shape.small,
        padding: "4px 8px",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

/**
 * The Start-menu power button. Mirrors Windows 11's footer power control: a
 * small inline menu of Sleep / Restart / Shut down. There is no machine to
 * power off in a demo desktop, so each posts a notification rather than
 * pretending to act.
 */
function PowerButton({ onAction }: { onAction: () => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const hover = `${theme.palette.textPrimary}14`;
  const items = ["Sleep", "Restart", "Shut down"];

  // Move focus into the menu when it opens so keyboard users land on an item.
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div style={{ position: "relative" }}>
      {open ? (
        <>
          <div
            role="presentation"
            onClick={() => {
              setOpen(false);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 1 }}
          />
          <div
            role="menu"
            aria-label="Power"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                // Close just this menu, not the whole Start menu around it.
                e.stopPropagation();
                close();
              }
            }}
            style={{
              position: "absolute",
              right: 0,
              bottom: 40,
              zIndex: 2,
              minWidth: 150,
              padding: 4,
              background: theme.palette.surface,
              backdropFilter: theme.blur.surface,
              WebkitBackdropFilter: theme.blur.surface,
              border: `1px solid ${theme.palette.border}`,
              borderRadius: theme.shape.small,
              boxShadow: "0 12px 28px -10px rgba(0,0,0,0.5)",
            }}
          >
            {items.map((label, i) => (
              <button
                key={label}
                ref={i === 0 ? firstItemRef : undefined}
                type="button"
                role="menuitem"
                onClick={() => {
                  notify({ title: label, body: "This is a demo desktop." });
                  setOpen(false);
                  onAction();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  color: theme.palette.textPrimary,
                  cursor: "pointer",
                  borderRadius: theme.shape.small,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <button
        ref={btnRef}
        type="button"
        aria-label="Power"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        style={{
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "transparent",
          color: theme.palette.textPrimary,
          cursor: "pointer",
          borderRadius: theme.shape.small,
        }}
      >
        <svg width={17} height={17} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 1.5v6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4.4 3.6a5 5 0 1 0 7.2 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** Accent-gradient app squircle, shared by the grid tile and the list rows. */
function ResultGlyph({ result, size }: { result: LauncherResult; size: number }) {
  const theme = useTheme();
  const accent = result.accent ?? theme.palette.accent;
  const Art = result.kind === "app" ? result.app.iconArt : undefined;
  const Icon =
    result.kind === "app"
      ? resolveAppIcon(result.app, theme)
      : result.kind === "system"
        ? resolveAppIcon(result.def, theme)
        : undefined;
  const externalIcon = result.kind === "external" ? result.icon : undefined;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: theme.shape.dockTileRadius,
        background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {Art ? (
        <Art size={Math.round(size * 0.7)} />
      ) : Icon ? (
        <Icon size={Math.round(size * 0.5)} />
      ) : externalIcon ? (
        externalIcon
      ) : (
        <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.42) }}>
          {result.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** A horizontal result row for the All apps list and the Recommended grid. */
function MenuRow({
  result,
  subtitle,
  index,
  selected,
  optionId,
  onHover,
  onActivate,
}: {
  result: LauncherResult;
  subtitle?: string;
  index?: number;
  selected?: boolean;
  optionId?: (index: number) => string;
  onHover?: () => void;
  onActivate: () => void;
}) {
  const theme = useTheme();
  return (
    <div
      id={index !== undefined && optionId ? optionId(index) : undefined}
      role={index !== undefined ? "option" : undefined}
      aria-selected={index !== undefined ? selected : undefined}
      onMouseEnter={(e) => {
        onHover?.();
        if (!selected) e.currentTarget.style.background = `${theme.palette.textPrimary}10`;
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
      onClick={onActivate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        padding: "6px 8px",
        borderRadius: theme.shape.small,
        cursor: "pointer",
        background: selected ? `${theme.palette.textPrimary}1f` : "transparent",
        transition: "background 100ms ease",
      }}
    >
      <ResultGlyph result={result} size={subtitle ? 30 : 24} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {result.name}
        </span>
        {subtitle ? (
          <span style={{ fontSize: 11, color: theme.palette.textSecondary }}>
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function resultKindLabel(result: LauncherResult): string {
  return result.kind === "app"
    ? "App"
    : result.kind === "system"
      ? "System"
      : (result.kindLabel ?? "External");
}

function ResultRow({
  result,
  index,
  selected,
  onHover,
  onActivate,
}: {
  result: LauncherResult;
  index: number;
  selected: boolean;
  onHover: () => void;
  onActivate: () => void;
}) {
  const theme = useTheme();
  const accent = result.accent ?? theme.palette.accent;
  const Icon =
    result.kind === "app"
      ? resolveAppIcon(result.app, theme)
      : result.kind === "system"
        ? resolveAppIcon(result.def, theme)
        : undefined;
  const externalIcon = result.kind === "external" ? result.icon : undefined;

  return (
    <div
      id={spotlightOptionId(index)}
      role="option"
      aria-selected={selected}
      data-spotlight-index={index}
      onMouseEnter={onHover}
      onClick={onActivate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "0 8px",
        padding: "0 12px",
        height: 44,
        borderRadius: theme.shape.small + 2,
        cursor: "pointer",
        backgroundColor: selected ? `${theme.palette.accent}38` : "transparent",
        transition: "background-color 80ms ease",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: theme.shape.small + 2,
          background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
        }}
      >
        {Icon ? (
          <Icon size={15} />
        ) : externalIcon ? (
          externalIcon
        ) : (
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {result.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 500,
          color: theme.palette.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {result.name}
      </span>
      <span
        style={{
          fontSize: 11,
          color: theme.palette.textSecondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 220,
        }}
      >
        {result.tagline ?? resultKindLabel(result)}
      </span>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: "32px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        color: theme.palette.textSecondary,
      }}
    >
      <span style={{ fontSize: 13 }}>
        {query.trim().length > 0
          ? `No matches for "${query.trim()}".`
          : "Nothing to show yet."}
      </span>
    </div>
  );
}

function HintChip({ keys, label }: { keys: string; label: string }) {
  const theme = useTheme();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <kbd
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "1px 6px",
          borderRadius: theme.shape.small - 2,
          backgroundColor: "rgba(255,255,255,0.06)",
          color: theme.palette.textSecondary,
          letterSpacing: 0.4,
          fontFamily: "inherit",
        }}
      >
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
