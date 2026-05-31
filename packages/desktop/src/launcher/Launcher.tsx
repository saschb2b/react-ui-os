"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTheme } from "../desktop-context";
import { getDockReservation } from "../util/layout";
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
  const launcher = useLauncher();
  if (!launcher.open) return null;
  switch (theme.chrome.launcher) {
    case "grid":
      return <GridView launcher={launcher} />;
    case "menu":
      return <MenuView launcher={launcher} />;
    default:
      return <SpotlightView launcher={launcher} />;
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

function SpotlightView({ launcher }: { launcher: LauncherState }) {
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
        animation: `rui-window-open ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
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
function GridView({ launcher }: { launcher: LauncherState }) {
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
        animation: `rui-window-open ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
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
  const Icon = result.kind === "app" ? result.app.icon : undefined;
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
const MENU_COLUMNS = 5;
function menuOptionId(index: number): string {
  return `rui-launcher-menu-option-${String(index)}`;
}

/**
 * Windows Start menu: a panel anchored just past the dock launcher, with a
 * search field above a grid of app tiles. Filters as you type; arrow keys move
 * a visual selection across the grid. Anchored and animated from the dock edge
 * (bottom-left for a bottom taskbar, beside a left dock).
 */
function MenuView({ launcher }: { launcher: LauncherState }) {
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
        moveSelection(MENU_COLUMNS);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveSelection(-MENU_COLUMNS);
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

  // Anchor the panel just past the dock: above a bottom taskbar, or beside a
  // left dock. Windows raises Start from its launcher rather than centering a
  // modal the way Spotlight does.
  const reservation = getDockReservation(theme);
  const gap = 8;
  const onLeft = theme.chrome.dockPosition === "left";
  const anchor = onLeft
    ? { left: reservation.left + gap, bottom: gap }
    : { left: gap, bottom: reservation.bottom + gap };

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
          width: "min(560px, calc(100vw - 16px))",
          maxHeight: "min(640px, 76vh)",
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
          padding: 16,
          gap: 14,
          transformOrigin: "bottom left",
          animation: `rui-window-open ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
        }}
      >
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
          }}
          placeholder="Search for apps"
          style={{
            width: "100%",
            height: 38,
            padding: "0 14px",
            border: `1px solid ${theme.palette.border}`,
            borderRadius: theme.shape.small,
            outline: "none",
            background: `${theme.palette.textPrimary}0f`,
            color: theme.palette.textPrimary,
            fontFamily: "inherit",
            fontSize: 14,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: theme.palette.textSecondary,
            flexShrink: 0,
          }}
        >
          {query.trim().length > 0 ? "Results" : "Pinned"}
        </div>
        <div
          id={MENU_LISTBOX_ID}
          role="listbox"
          aria-label="Apps"
          style={{
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: `repeat(${String(MENU_COLUMNS)}, 1fr)`,
            gap: 6,
            justifyItems: "center",
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
              {query.trim().length > 0
                ? `No matches for "${query.trim()}".`
                : "No apps."}
            </div>
          ) : (
            results.map((result, i) => (
              <LauncherTile
                key={result.key}
                result={result}
                index={i}
                size={44}
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
      </div>
    </>
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
  const Icon = result.kind === "app" ? result.app.icon : undefined;
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
