"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTheme } from "../desktop-context";
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
