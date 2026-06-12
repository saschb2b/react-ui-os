"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { notify, useWindowManager } from "@react-ui-os/core";
import { useApps, useDesktopContext, useTheme } from "../desktop-context";
import { resolveAppIcon } from "../util/app-icon";
import { SpacesBar } from "../spaces-bar";
import { getDockReservation, getMenuBarHeight } from "../util/layout";
import {
  countRecentsSources,
  listRecentItems,
  subscribeRecentsSources,
} from "../recents";
import { nextCascadeIndex, pickInitialBounds } from "../util/initial-bounds";
import { useReducedMotion } from "../util/use-reduced-motion";
import {
  useSurfaceTransition,
  type SurfacePhase,
} from "../util/use-surface-transition";
import { useLauncher, type LauncherResult, type LauncherState } from "./use-launcher";
import { groupByCategory } from "./start-categories";

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
  // The Start menu rises a distance from the taskbar edge, so it animates over
  // a longer beat than the centered scale-fade the other launchers use.
  const isMenu = theme.chrome.launcher === "menu";
  const openMs = reducedMotion
    ? 0
    : isMenu
      ? START_RISE_MS
      : theme.motion.windowOpenDurationMs;
  const { mounted, phase, surfaceStyle } = useSurfaceTransition(launcher.open, {
    durationMs: openMs,
    easing: theme.motion.windowOpenEasing,
  });
  if (!mounted) return null;
  switch (theme.chrome.launcher) {
    case "grid":
      return <GridView launcher={launcher} surfaceStyle={surfaceStyle} />;
    case "menu":
      // The Start menu rises from the taskbar edge instead of the shared
      // scale-fade, so it gets the phase rather than the ready-made style.
      return <MenuView launcher={launcher} phase={phase} />;
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
  const { state, windows, switchWorkspace, addWorkspace } = useWindowManager();
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
      {/* The GNOME overview keeps the workspace thumbnails above the app grid;
          clicking one switches to that space and dismisses the overview. */}
      <SpacesBar
        workspaces={state.workspaces}
        activeId={state.activeWorkspaceId}
        onSwitch={(id) => {
          switchWorkspace(id);
          close();
        }}
        onAdd={addWorkspace}
        windows={windows}
        wallpaperSrc={theme.wallpaper.src}
        theme={theme}
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
  selected = false,
  onHover,
  onActivate,
  size = 72,
  optionId = gridOptionId,
  plain = false,
}: {
  result: LauncherResult;
  /** Listbox option index. Omitted, the tile renders without option ARIA. */
  index?: number;
  selected?: boolean;
  onHover?: () => void;
  onActivate: () => void;
  size?: number;
  optionId?: (index: number) => string;
  /**
   * Render the icon bare instead of on the accent squircle, the Windows 11
   * pinned-tile look (a plain app icon over a hover highlight). Falls back to
   * the squircle monogram when the result has no icon at all.
   */
  plain?: boolean;
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
  const bare = plain && (Art ?? Icon ?? externalIcon) !== undefined;
  return (
    <div
      id={index !== undefined ? optionId(index) : undefined}
      role={index !== undefined ? "option" : undefined}
      aria-selected={index !== undefined ? selected : undefined}
      onMouseEnter={(e) => {
        onHover?.();
        // Outside a listbox there is no selection to highlight, so hover
        // paints directly, the way the menu rows do.
        if (index === undefined)
          e.currentTarget.style.background = `${theme.palette.textPrimary}10`;
      }}
      onMouseLeave={(e) => {
        if (index === undefined) e.currentTarget.style.background = "transparent";
      }}
      onClick={onActivate}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "12px 6px",
        borderRadius: plain ? theme.shape.small : theme.shape.windowRadius,
        cursor: "pointer",
        background: selected ? `${theme.palette.textPrimary}1f` : "transparent",
        transition: "background 100ms ease",
      }}
    >
      <div
        style={{
          width: tile,
          height: tile,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...(bare
            ? { color: theme.palette.textPrimary }
            : {
                borderRadius: theme.shape.dockTileRadius,
                background: `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
                color: "#fff",
              }),
        }}
      >
        {Art ? (
          <Art size={Math.round(tile * (bare ? 0.8 : 0.7))} />
        ) : Icon ? (
          <Icon size={Math.round(tile * (bare ? 0.8 : 0.46))} />
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
// panel (the classic 100%-scale size is ~640x720). The redesigned Start comes
// in a 6-column and an 8-column register, and the May 2026 controls expose
// the choice as "Small or Large": small is the classic-width 6-column panel,
// large scales the width with the extra columns and takes the classic height.
// Sources: https://www.neowin.net/guides/how-to-resize-the-start-menu-in-windows-11/ ;
// https://www.windowscentral.com/microsoft/windows-11/whats-in-the-new-start-menu-on-windows-11-for-versions-25h2-and-24h2
// The redesigned Start is a tall panel: ~640px wide at six columns, ~820px at
// eight, and tall enough to fill most of the screen height (the widely noted
// "huge" new Start). The height fields are ceilings the panel grows up to; the
// actual height tracks a fraction of the available space (see height below).
// Sources: https://www.neowin.net/guides/how-to-resize-the-start-menu-in-windows-11/ ;
// https://www.pcworld.com/article/3003808/windows-11s-newly-revamped-start-menu-design-is-annoyingly-large.html
const MENU_SIZES = {
  small: { width: 640, height: 820, columns: 6 },
  large: { width: 820, height: 1000, columns: 8 },
} as const;
// The Recent region (Windows 11's renamed Recommended) is a 2-column grid of
// six slots; up to four go to recently used apps, files fill the rest.
const RECENT_SLOTS = 6;
const RECENT_APP_SLOTS = 4;
// The Start menu's rise-and-sink entrance runs longer than a plain window open
// so the slide reads clearly: the Windows Start flyout uses a decelerating
// entrance around a quarter second, not the snappier window pop.
const START_RISE_MS = 250;
// The redesigned Start shows two rows of pins before "Show all" expands the
// rest, and remembers the expansion across opens.
// Source: https://kartikmehtablog.com/windows-11-25h2-new-start-menu/
const PINNED_DEFAULT_ROWS = 2;
const PINS_EXPANDED_KEY = "start-pins-expanded";
function menuOptionId(index: number): string {
  return `rui-launcher-menu-option-${String(index)}`;
}

/**
 * Windows Start menu: a panel anchored just past the dock launcher, rebuilt
 * on the 25H2 redesigned Start's single scrollable surface: a search field
 * over the Pinned grid (two rows until "Show all", remembered across opens),
 * the Recent region, and the All apps section at the bottom. Filters as you
 * type; arrow keys move a visual selection across the pinned grid. Anchored
 * and animated from the dock edge.
 * Source: https://www.windowscentral.com/microsoft/windows-11/whats-in-the-new-start-menu-on-windows-11-for-versions-25h2-and-24h2
 */
function MenuView({
  launcher,
  phase,
}: {
  launcher: LauncherState;
  phase: SurfacePhase;
}) {
  const theme = useTheme();
  const apps = useApps();
  const { storage } = useDesktopContext();
  const reducedMotion = useReducedMotion();
  const { state, openWindow, windows } = useWindowManager();
  const { query, setQuery, results, selectedIndex, setSelectedIndex } = launcher;
  const { moveSelection, activate, activateSelected, close } = launcher;
  const inputRef = useRef<HTMLInputElement | null>(null);
  // The May 2026 Start personalization: independent section toggles, a
  // small/large size, and the option to hide the profile chip.
  // Source: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/
  const pinnedOn = theme.chrome.startMenuPinned ?? true;
  const allAppsOn = theme.chrome.startMenuAllApps ?? true;
  const recentOn = theme.chrome.startMenuRecent ?? true;
  const recentFilesOn = theme.chrome.startMenuRecentFiles ?? true;
  const profileOn = theme.chrome.startMenuProfile ?? true;
  // "auto" (the Windows default) takes the large 8-column panel when the
  // viewport is wide enough to seat it with margins, else small. The
  // threshold is the large width plus its open gaps.
  const sizePref = theme.chrome.startMenuSize ?? "auto";
  const vwForSize = typeof window === "undefined" ? 1280 : window.innerWidth;
  const sizeKey =
    sizePref === "auto"
      ? vwForSize >= MENU_SIZES.large.width + 48
        ? "large"
        : "small"
      : sizePref;
  const menuSize = MENU_SIZES[sizeKey];
  // Two rows of pins until "Show all"; the explicit toggle persists the way
  // Windows remembers the expansion across opens. Arrowing past the visible
  // rows expands for the session without persisting.
  const [showAllPins, setShowAllPins] = useState<boolean>(
    () => storage.get<boolean>(PINS_EXPANDED_KEY) ?? false,
  );
  const togglePins = (next: boolean) => {
    setShowAllPins(next);
    storage.set(PINS_EXPANDED_KEY, next);
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  const searching = query.trim().length > 0;
  const cols = menuSize.columns;
  const defaultPins = cols * PINNED_DEFAULT_ROWS;
  const gridCount =
    searching || showAllPins ? results.length : Math.min(results.length, defaultPins);
  // The combobox listbox is the search-results grid while typing, otherwise
  // the pinned grid; Enter must not launch a selection neither shows.
  const showListbox = searching || pinnedOn;
  // Keep the keyboard usable over a collapsed grid: moving the selection past
  // the visible rows expands the pins for this open only.
  useEffect(() => {
    if (!searching && !showAllPins && pinnedOn && selectedIndex >= gridCount) {
      setShowAllPins(true);
    }
  }, [searching, showAllPins, pinnedOn, selectedIndex, gridCount]);
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
        if (showListbox) activateSelected();
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  // The "Recent" section, Windows 11's renamed Recommended: recently used
  // apps lead (the May 2026 post keeps apps "visible as the primary discovery
  // method") and recently used files contributed via registerRecentsSource
  // fill the remaining slots, newest first. Six slots, the 2x3 grid of the
  // Windows Recommended region.
  // Source: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/
  const zByApp = new Map<string, number>();
  for (const w of windows) {
    if (w.payload.kind === "app") {
      zByApp.set(w.payload.appId, Math.max(zByApp.get(w.payload.appId) ?? 0, w.z));
    }
  }
  const recentApps = (recentOn ? results : [])
    .filter((r) => r.kind === "app" && zByApp.has(r.app.id))
    .sort((a, b) => {
      const za = a.kind === "app" ? (zByApp.get(a.app.id) ?? 0) : 0;
      const zb = b.kind === "app" ? (zByApp.get(b.app.id) ?? 0) : 0;
      return zb - za;
    })
    .slice(0, RECENT_APP_SLOTS);
  // Re-render when a recents source registers; the items themselves are read
  // fresh on every open since the menu mounts per open.
  useSyncExternalStore(subscribeRecentsSources, countRecentsSources, () => 0);
  const recentRows: Array<{
    key: string;
    result: LauncherResult;
    subtitle: string;
  }> = [
    ...recentApps.map((r) => ({
      key: `rec:${r.key}`,
      result: r,
      subtitle: "Recently used",
    })),
    // The separate file control: off hides the file rows, apps stay.
    ...(recentOn && recentFilesOn ? listRecentItems() : [])
      .slice(0, Math.max(0, RECENT_SLOTS - recentApps.length))
      .map((f) => ({
        key: `rec-file:${f.sourceId}:${f.id}`,
        result: {
          kind: "external" as const,
          key: `rec-file:${f.sourceId}:${f.id}`,
          name: f.name,
          accent: f.accent,
          icon: f.icon,
          kindLabel: f.kindLabel,
          onActivate: f.onActivate,
        },
        subtitle: f.kindLabel
          ? `${f.kindLabel} · ${relativeTime(f.timestamp)}`
          : relativeTime(f.timestamp),
      })),
  ];

  const openSettings = () => {
    const payload = { kind: "system" as const, systemId: "settings" };
    openWindow(
      payload,
      pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
    );
    close();
  };

  // Raise Start from the taskbar edge, the way Windows 11 does ("when the
  // taskbar is on the top, Start opens from the top"). Along the bar's long
  // axis the panel follows the taskbar alignment, not the Start button:
  // a centered taskbar opens Start centered on the screen, a left-aligned
  // (Windows 10) taskbar anchors it to the left edge. The Start button is the
  // leftmost of a centered cluster, so centering on the button would sit the
  // panel left of where Windows puts it.
  // Sources: https://blogs.windows.com/windows-insider/2026/05/15/improving-windows-quality-making-taskbar-and-start-more-personal/ ;
  // https://www.dell.com/support/kbdoc/en-us/000192071/how-to-change-the-windows-11-taskbar-alignment
  const reservation = getDockReservation(theme);
  const gap = 8;
  const dockPosition = theme.chrome.dockPosition;
  const align = theme.chrome.dockAlign ?? "center";
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const btn =
    typeof document === "undefined"
      ? null
      : (document
          .querySelector('[data-rui-dock] [aria-label="Open launcher"]')
          ?.getBoundingClientRect() ?? null);
  const width = Math.min(menuSize.width, vw - 2 * gap);
  // Horizontal placement along a top/bottom bar by taskbar alignment, clamped
  // into the viewport. Start (Windows 10) hugs the left, center sits on the
  // screen center, end hugs the right.
  const horizontalLeft = () => {
    const raw =
      align === "start"
        ? reservation.left + gap
        : align === "end"
          ? vw - reservation.right - width - gap
          : (vw - width) / 2;
    return Math.max(gap, Math.min(raw, vw - width - gap));
  };
  let anchor: CSSProperties;
  let menuOrigin: string;
  let available: number;
  if (dockPosition === "left" || dockPosition === "right") {
    // Beside the vertical dock, dropping down from the launcher button.
    const top = btn ? Math.max(gap, Math.min(btn.top, vh - gap - 220)) : gap;
    anchor =
      dockPosition === "left"
        ? { left: reservation.left + gap, top }
        : { right: reservation.right + gap, top };
    menuOrigin = dockPosition === "left" ? "top left" : "top right";
    available = vh - top - gap;
  } else if (dockPosition === "top") {
    const left = horizontalLeft();
    const top = getMenuBarHeight(theme) + reservation.top + gap;
    anchor = { left, top };
    // Rise from the bottom edge of the panel toward the screen, pivoting over
    // the Start button when it sits under the panel, else the panel center.
    const pivotX = btn ? Math.round(btn.left + btn.width / 2 - left) : width / 2;
    menuOrigin = `${String(Math.max(0, Math.min(pivotX, width)))}px 0px`;
    available = vh - top - gap;
  } else {
    const left = horizontalLeft();
    anchor = { left, bottom: reservation.bottom + gap };
    const pivotX = btn ? Math.round(btn.left + btn.width / 2 - left) : width / 2;
    menuOrigin = `${String(Math.max(0, Math.min(pivotX, width)))}px 100%`;
    available = vh - reservation.bottom - 2 * gap;
  }
  // The redesigned Start is tall: it fills most of the screen height (~90% on
  // a typical display) rather than the old compact panel, so the size's height
  // is a ceiling that the panel takes up to, but it grows toward most of the
  // available height first. Small keeps a more compact register.
  // Source: https://www.pcworld.com/article/3003808/windows-11s-newly-revamped-start-menu-design-is-annoyingly-large.html
  const heightFill = sizeKey === "large" ? 0.9 : 0.78;
  const height = Math.min(menuSize.height, Math.round(available * heightFill));

  // Start rises from the taskbar edge on open and sinks back on close (the
  // Windows entrance), so the slide offset points away from that edge: up from
  // a bottom bar, down from a top bar, in from a side bar. ~48px reads as a
  // clear rise without overshooting.
  const RISE = 48;
  const riseVars: CSSProperties =
    dockPosition === "top"
      ? { ["--rui-rise-y" as string]: `${String(-RISE)}px` }
      : dockPosition === "left"
        ? { ["--rui-rise-x" as string]: `${String(-RISE)}px` }
        : dockPosition === "right"
          ? { ["--rui-rise-x" as string]: `${String(RISE)}px` }
          : { ["--rui-rise-y" as string]: `${String(RISE)}px` };
  const riseStyle: CSSProperties = reducedMotion
    ? {}
    : {
        ...riseVars,
        animation: `${
          phase === "closing" ? "rui-surface-sink" : "rui-surface-rise"
        } ${String(START_RISE_MS)}ms ${theme.motion.windowOpenEasing} both`,
      };

  // The Windows pinned tile: a bare 32px app icon over a hover highlight,
  // arranged in the section's 6- or 8-column grid.
  const listbox = (
    <div
      id={MENU_LISTBOX_ID}
      role="listbox"
      aria-label={searching ? "Results" : "Pinned"}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${String(cols)}, 1fr)`,
        gap: 4,
        justifyItems: "center",
        alignContent: "start",
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
      ) : (
        results.slice(0, gridCount).map((result, i) => (
          <LauncherTile
            key={result.key}
            result={result}
            index={i}
            size={40}
            plain
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

  // The All section closes the scrollable page, every entry A to Z. The
  // redesigned Start defaults to its Category view; without category data the
  // list view is the honest register here.
  const allSorted = [...results].sort((a, b) => a.name.localeCompare(b.name));

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
          ...riseStyle,
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
          {searching ? (
            <>
              <MenuSectionHeader label="Results" />
              {listbox}
            </>
          ) : pinnedOn ? (
            <>
              <MenuSectionHeader
                label="Pinned"
                action={
                  results.length > defaultPins
                    ? showAllPins
                      ? {
                          label: "Show less",
                          onClick: () => {
                            togglePins(false);
                          },
                          back: true,
                        }
                      : {
                          label: "Show all",
                          onClick: () => {
                            togglePins(true);
                          },
                        }
                    : undefined
                }
              />
              {listbox}
            </>
          ) : null}

          {!searching && recentRows.length > 0 ? (
            <>
              <div style={{ height: 6 }} />
              <MenuSectionHeader label="Recent" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                }}
              >
                {recentRows.map(({ key, result, subtitle }) => (
                  <MenuRow
                    key={key}
                    result={result}
                    subtitle={subtitle}
                    onActivate={() => {
                      activate(result);
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}

          {!searching && allAppsOn && allSorted.length > 0 ? (
            <MenuAllSection
              items={allSorted}
              onActivate={(result) => {
                activate(result);
              }}
            />
          ) : null}
        </div>

        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            // The privacy option hides the name and picture; the power button
            // stays, holding the trailing corner as on Windows.
            justifyContent: profileOn ? "space-between" : "flex-end",
            padding: "8px 14px",
            borderTop: `1px solid ${theme.palette.border}`,
            background: `${theme.palette.textPrimary}08`,
          }}
        >
          {profileOn ? (
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
          ) : null}
          <PowerButton onAction={close} />
        </div>
      </div>
    </>
  );
}

/* The All section of the redesigned Start, in its three views: Category
 * (default, folder cards that open a flyout of the category's apps), Grid
 * (alphabetical icon groups), and List (the classic compact rows). Letter
 * headers open an in-place alphabet picker for jumping, the view choice
 * persists, and a category forms only once at least three entries carry it;
 * everything else files under Other.
 * Sources: https://kartikmehtablog.com/windows-11-25h2-new-start-menu/ ;
 * https://www.windowslatest.com/2025/06/18/you-cannot-create-new-categories-in-new-windows-11-start-menu/
 */

type StartAllView = "category" | "grid" | "list";
const ALL_VIEW_KEY = "start-all-view";
const ALL_VIEWS = ["category", "grid", "list"] as const;
const ALL_VIEW_LABELS: Record<StartAllView, string> = {
  category: "Category",
  grid: "Grid",
  list: "List",
};
const ALL_ALPHABET = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"] as const;
// Windows files apps whose names start outside A-Z under a leading "#".
function letterOf(name: string): string {
  const c = name.charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

/** The bare icon of a result (no squircle), for category-card minis. */
function ResultMiniIcon({ result, size }: { result: LauncherResult; size: number }) {
  const theme = useTheme();
  const Art = result.kind === "app" ? result.app.iconArt : undefined;
  const Icon =
    result.kind === "app"
      ? resolveAppIcon(result.app, theme)
      : result.kind === "system"
        ? resolveAppIcon(result.def, theme)
        : undefined;
  if (Art) return <Art size={size} />;
  if (Icon) return <Icon size={size} />;
  if (result.kind === "external" && result.icon) return <>{result.icon}</>;
  return (
    <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.8) }}>
      {result.name.charAt(0).toUpperCase()}
    </span>
  );
}

function MenuAllSection({
  items,
  onActivate,
}: {
  items: LauncherResult[];
  onActivate: (result: LauncherResult) => void;
}) {
  const theme = useTheme();
  const { storage } = useDesktopContext();
  const reducedMotion = useReducedMotion();
  const [view, setView] = useState<StartAllView>(() => {
    const stored = storage.get<string>(ALL_VIEW_KEY);
    return (ALL_VIEWS as readonly string[]).includes(stored ?? "")
      ? (stored as StartAllView)
      : "category";
  });
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  // The open category flyout, by name. It renders inside the Start dialog,
  // whose backdrop-filter makes it the containing block for the flyout's
  // fixed positioning, so the card centers on the dialog with plain
  // percentages (no viewport measurement, which would double-count the
  // dialog offset and push the card off-center).
  const [flyout, setFlyout] = useState<string | null>(null);
  // Move focus into the flyout on open (so Esc works and a screen reader
  // announces it) and back to the card that opened it on close.
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const flyoutTriggerRef = useRef<HTMLElement | null>(null);
  const openFlyout = (category: string, trigger: HTMLElement) => {
    flyoutTriggerRef.current = trigger;
    setFlyout(category);
  };
  const closeFlyout = () => {
    setFlyout(null);
    flyoutTriggerRef.current?.focus();
    flyoutTriggerRef.current = null;
  };
  useEffect(() => {
    if (flyout) flyoutRef.current?.focus();
  }, [flyout]);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  // The picker replaces the groups in place, so the jump target scrolls once
  // the groups are mounted again.
  const pendingJumpRef = useRef<string | null>(null);
  useEffect(() => {
    if (jumpOpen || pendingJumpRef.current === null) return;
    sectionRefs.current.get(pendingJumpRef.current)?.scrollIntoView({
      block: "start",
    });
    pendingJumpRef.current = null;
  }, [jumpOpen]);

  const groups = ALL_ALPHABET.map((letter) => ({
    letter,
    items: items.filter((i) => letterOf(i.name) === letter),
  })).filter((g) => g.items.length > 0);
  const present = new Set(groups.map((g) => g.letter));

  // Category grouping: a named category renders only with three or more
  // entries, everything else folds into Other (last). Items arrive sorted, so
  // each category stays alphabetical. (External results have no category, so
  // they always land in Other.)
  const categories = groupByCategory(
    items.map((item) => ({
      result: item,
      name: item.name,
      category: item.kind !== "external" ? item.category : undefined,
    })),
  ).map((g) => ({ name: g.name, items: g.items.map((i) => i.result) }));
  const flyoutItems = flyout
    ? (categories.find((c) => c.name === flyout)?.items ?? [])
    : [];

  const chooseView = (next: StartAllView) => {
    setView(next);
    storage.set(ALL_VIEW_KEY, next);
    setViewMenuOpen(false);
  };
  const hover = `${theme.palette.textPrimary}14`;

  return (
    <>
      <div style={{ height: 6 }} />
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
          All
        </span>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={viewMenuOpen}
            aria-label="Change All apps view"
            onClick={() => {
              setViewMenuOpen((v) => !v);
            }}
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
            {/* Windows labels the All-apps view switcher "View: <mode>". */}
            {`View: ${ALL_VIEW_LABELS[view]}`}
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden>
              <path
                d="M2 3.5 5 6.5 8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {viewMenuOpen ? (
            <>
              <div
                role="presentation"
                onClick={() => {
                  setViewMenuOpen(false);
                }}
                style={{ position: "fixed", inset: 0, zIndex: 1 }}
              />
              <div
                role="menu"
                aria-label="All apps view"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  zIndex: 2,
                  minWidth: 120,
                  padding: 4,
                  background: theme.palette.surface,
                  backdropFilter: theme.blur.surface,
                  WebkitBackdropFilter: theme.blur.surface,
                  border: `1px solid ${theme.palette.border}`,
                  borderRadius: theme.shape.small,
                  boxShadow: "0 12px 28px -10px rgba(0,0,0,0.5)",
                }}
              >
                {ALL_VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="menuitemradio"
                    aria-checked={view === v}
                    onClick={() => {
                      chooseView(v);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = hover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      color: theme.palette.textPrimary,
                      cursor: "pointer",
                      borderRadius: theme.shape.small,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ width: 12 }}>{view === v ? "✓" : ""}</span>
                    {ALL_VIEW_LABELS[v]}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {view === "category" && !jumpOpen ? (
        // Category folder cards, the Android-folder pattern Windows adopted: a
        // large rounded tile holding a 2x2 of the category's first app icons at
        // real size, the category name centered below, ~3 cards per row.
        // Clicking a card opens its flyout.
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            alignContent: "start",
            paddingTop: 4,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={(e) => {
                openFlyout(cat.name, e.currentTarget);
              }}
              onMouseEnter={(e) => {
                const tile = e.currentTarget.firstElementChild as HTMLElement | null;
                if (tile) tile.style.background = `${theme.palette.textPrimary}1a`;
              }}
              onMouseLeave={(e) => {
                const tile = e.currentTarget.firstElementChild as HTMLElement | null;
                if (tile) tile.style.background = `${theme.palette.textPrimary}0d`;
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: 0,
                border: "none",
                background: "transparent",
                color: theme.palette.textPrimary,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 152,
                  borderRadius: theme.shape.windowRadius + 2,
                  background: `${theme.palette.textPrimary}0d`,
                  border: `1px solid ${theme.palette.border}`,
                  transition: "background 120ms ease",
                }}
              >
                {/* The four preview icons sit in a tight 2x2 cluster centered
                    in the card, the Windows folder-preview look, rather than
                    spread to the card's corners. */}
                <span
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 36px)",
                    gridTemplateRows: "repeat(2, 36px)",
                    gap: 8,
                  }}
                >
                  {cat.items.slice(0, 4).map((item) => (
                    <span
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <ResultMiniIcon result={item} size={36} />
                    </span>
                  ))}
                </span>
              </span>
              <span
                style={{
                  maxWidth: "100%",
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {flyout ? (
        <>
          {/* Dim and blur the Start panel behind the flyout, the way Windows
              recedes Start when a category opens. inset:0 fills the dialog,
              which is the containing block (its backdrop-filter establishes
              one for these fixed children). */}
          <div
            role="presentation"
            onClick={closeFlyout}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1401,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              animation: reducedMotion
                ? undefined
                : `rui-fade-in ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
            }}
          />
          <div
            ref={flyoutRef}
            role="dialog"
            aria-modal="true"
            aria-label={flyout}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                // Close just the flyout, not the Start menu around it.
                e.stopPropagation();
                closeFlyout();
              }
            }}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              outline: "none",
              transform: "translate(-50%, -50%)",
              width: "min(86%, 620px)",
              maxHeight: "78%",
              zIndex: 1402,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: "28px 28px 24px",
              background: theme.palette.surface,
              backdropFilter: theme.blur.spotlight,
              WebkitBackdropFilter: theme.blur.spotlight,
              border: `1px solid ${theme.palette.border}`,
              borderRadius: theme.shape.windowRadius + 4,
              color: theme.palette.textPrimary,
              boxShadow: "0 32px 70px -18px rgba(0,0,0,0.7)",
              // Scale-and-fade in from center, the Windows flyout entrance. The
              // keyframe animates `scale`, which composes with the centering
              // translate rather than replacing it.
              animation: reducedMotion
                ? undefined
                : `rui-window-open ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
            }}
          >
            <h2
              style={{
                margin: 0,
                textAlign: "center",
                fontSize: 22,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {flyout}
            </h2>
            <div
              style={{
                overflowY: "auto",
                // A centered wrap (not a fixed 4-column grid) so a short
                // category centers its row under the heading instead of
                // left-packing, the Windows flyout layout. Each tile gets a
                // fixed cell width so columns still line up.
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 8,
                alignContent: "start",
              }}
            >
              {flyoutItems.map((result) => (
                <div key={`cat:${result.key}`} style={{ width: 116, flexShrink: 0 }}>
                  <LauncherTile
                    result={result}
                    size={48}
                    plain
                    onActivate={() => {
                      flyoutTriggerRef.current = null;
                      setFlyout(null);
                      onActivate(result);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {view === "category" ? null : jumpOpen ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            padding: "8px 0",
          }}
        >
          {ALL_ALPHABET.map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={!present.has(letter)}
              onClick={() => {
                pendingJumpRef.current = letter;
                setJumpOpen(false);
              }}
              onMouseEnter={(e) => {
                if (present.has(letter)) e.currentTarget.style.background = hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                height: 40,
                border: "none",
                background: "transparent",
                color: present.has(letter)
                  ? theme.palette.accent
                  : theme.palette.textSecondary,
                opacity: present.has(letter) ? 1 : 0.45,
                cursor: present.has(letter) ? "pointer" : "default",
                borderRadius: theme.shape.small,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.letter}
            ref={(el) => {
              if (el) sectionRefs.current.set(group.letter, el);
              else sectionRefs.current.delete(group.letter);
            }}
          >
            <button
              type="button"
              aria-label={`Jump from ${group.letter}`}
              onClick={() => {
                setJumpOpen(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                display: "block",
                border: "none",
                background: "transparent",
                color: theme.palette.textPrimary,
                cursor: "pointer",
                borderRadius: theme.shape.small,
                padding: "6px 8px",
                margin: "2px 0",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              {group.letter}
            </button>
            {view === "grid" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 4,
                  justifyItems: "center",
                  alignContent: "start",
                }}
              >
                {group.items.map((result) => (
                  <LauncherTile
                    key={`all:${result.key}`}
                    result={result}
                    size={36}
                    plain
                    onActivate={() => {
                      onActivate(result);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {group.items.map((result) => (
                  <MenuRow
                    key={`all:${result.key}`}
                    result={result}
                    onActivate={() => {
                      onActivate(result);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}
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
      <span style={{ fontSize: 13, fontWeight: 600, color: theme.palette.textPrimary }}>
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
        if (!selected)
          e.currentTarget.style.background = `${theme.palette.textPrimary}10`;
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

/**
 * Short recency label under a Recent file row, the Windows style ("12m ago",
 * "2h ago", "Yesterday"); older items fall back to the locale date.
 */
function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return new Date(ts).toLocaleDateString();
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
