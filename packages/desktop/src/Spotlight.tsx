"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { App } from "@react-ui-os/core";
import { useWindowManager } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { SPOTLIGHT_OPEN_EVENT } from "./events";
import {
  listSystemWindows,
  resolveSystemWindowName,
  type SystemWindowDef,
} from "./system-windows";
import {
  listSpotlightSources,
  subscribeSpotlightSources,
} from "./spotlight-sources";

type Result =
  | { kind: "app"; key: string; name: string; tagline?: string; accent?: string; icon?: ReactNode; app: App }
  | {
      kind: "system";
      key: string;
      name: string;
      tagline?: string;
      accent?: string;
      icon?: ReactNode;
      systemId: string;
      def: SystemWindowDef;
    }
  | {
      kind: "external";
      key: string;
      name: string;
      tagline?: string;
      accent?: string;
      icon?: ReactNode;
      kindLabel?: string;
      onActivate: () => void;
    };

/**
 * Cmd/Ctrl+K command palette. Self-contained: it owns its open/close
 * state, listens for both the keyboard shortcut and SPOTLIGHT_OPEN_EVENT,
 * and restores the previously focused element on close. Activating a
 * result calls `openWindow(...)` (the same primitive a dock click uses),
 * so the shortest path from "I typed three letters" to "the right window
 * is on top" reuses the system's existing plumbing.
 *
 * Phase 1: searches across registered apps only. Future phases extend the
 * result set with presets, downloads, and Settings entries without
 * changing the activation contract.
 */
export function Spotlight() {
  const theme = useTheme();
  const apps = useApps();
  const { openWindow } = useWindowManager();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleOpen = useCallback(() => {
    previousFocusRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    setQuery("");
    setSelectedIndex(0);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    const prev = previousFocusRef.current;
    if (prev && typeof prev.focus === "function") {
      window.setTimeout(() => {
        prev.focus();
      }, 0);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isCmdK) return;
      if (!open) {
        const t = e.target as HTMLElement | null;
        const inField =
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable);
        if (inField) return;
        e.preventDefault();
        handleOpen();
        return;
      }
      e.preventDefault();
      handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, handleOpen, handleClose]);

  useEffect(() => {
    const onOpenEvt = () => {
      if (!open) handleOpen();
    };
    window.addEventListener(SPOTLIGHT_OPEN_EVENT, onOpenEvt);
    return () => {
      window.removeEventListener(SPOTLIGHT_OPEN_EVENT, onOpenEvt);
    };
  }, [open, handleOpen]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [open]);

  // Re-render Spotlight whenever a source registers / unregisters. The
  // hook returns an opaque token; we only need its referential change.
  const sourcesVersion = useSyncExternalStore(
    subscribeSpotlightSources,
    () => listSpotlightSources().length,
    () => 0,
  );

  const results = useMemo<Result[]>(() => {
    void sourcesVersion;
    const appResults: Result[] = apps.map((app) => ({
      kind: "app",
      key: `app:${app.id}`,
      name: app.name,
      tagline: app.tagline,
      accent: app.accent,
      app,
    }));
    const systemResults: Result[] = listSystemWindows().map((sys) => ({
      kind: "system",
      key: `system:${sys.systemId}`,
      name: resolveSystemWindowName(sys),
      tagline: sys.tagline,
      accent: sys.accent,
      systemId: sys.systemId,
      def: sys,
    }));
    const q = query.trim().toLowerCase();
    // Sources receive the trimmed query; they decide how to filter their
    // own data. Each result is tagged with the source id to avoid clashes.
    const externalResults: Result[] = listSpotlightSources().flatMap(
      (source, idx) => {
        try {
          return source(q).map((r) => ({
            kind: "external" as const,
            key: `external:${String(idx)}:${r.id}`,
            name: r.name,
            tagline: r.tagline,
            accent: r.accent,
            icon: r.icon,
            kindLabel: r.kindLabel,
            onActivate: r.onActivate,
          }));
        } catch {
          // A misbehaving source should not bring down Spotlight.
          return [];
        }
      },
    );
    const builtIn: Result[] = [...appResults, ...systemResults];
    if (!q) return [...builtIn, ...externalResults];
    const filteredBuiltIn = builtIn.filter((r) => {
      const name = r.name.toLowerCase();
      const tag = (r.tagline ?? "").toLowerCase();
      return name.includes(q) || tag.includes(q);
    });
    return [...filteredBuiltIn, ...externalResults];
  }, [apps, query, sourcesVersion]);

  useEffect(() => {
    setSelectedIndex((idx) => {
      if (results.length === 0) return 0;
      if (idx >= results.length) return results.length - 1;
      if (idx < 0) return 0;
      return idx;
    });
  }, [results.length]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-spotlight-index="${String(selectedIndex)}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  const activate = useCallback(
    (result: Result) => {
      if (result.kind === "app") {
        openWindow({ kind: "app", appId: result.app.id });
      } else if (result.kind === "system") {
        openWindow({ kind: "system", systemId: result.systemId });
      } else {
        result.onActivate();
      }
      handleClose();
    },
    [openWindow, handleClose],
  );

  const handlePaletteKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((idx) => {
          if (results.length === 0) return 0;
          return (idx + 1) % results.length;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((idx) => {
          if (results.length === 0) return 0;
          return (idx - 1 + results.length) % results.length;
        });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const target = results[selectedIndex];
        if (target) activate(target);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    },
    [results, selectedIndex, activate, handleClose],
  );

  const handleBackdropClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose],
  );

  if (!open) return null;

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
        {/* Search input */}
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

        {/* Results */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Spotlight results"
          style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 0" }}
        >
          {results.length === 0 ? (
            <EmptyState query={query} theme={theme} />
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

        {/* Footer hint bar */}
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
          <HintChip keys="↑↓" label="Navigate" theme={theme} />
          <HintChip keys="↵" label="Open" theme={theme} />
          <HintChip keys="Esc" label="Close" theme={theme} />
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  index,
  selected,
  onHover,
  onActivate,
}: {
  result: Result;
  index: number;
  selected: boolean;
  onHover: () => void;
  onActivate: () => void;
}) {
  const theme = useTheme();
  const accent = result.accent ?? theme.palette.accent;
  const Icon = result.kind === "app" ? result.app.icon : undefined;
  const externalIcon = result.kind === "external" ? result.icon : undefined;
  const kindLabel =
    result.kind === "app"
      ? "App"
      : result.kind === "system"
        ? "System"
        : (result.kindLabel ?? "External");

  return (
    <div
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
        backgroundColor: selected
          ? "rgba(120,160,220,0.22)"
          : "transparent",
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
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.3)",
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
        {result.tagline ?? kindLabel}
      </span>
    </div>
  );
}

function EmptyState({
  query,
  theme,
}: {
  query: string;
  theme: ReturnType<typeof useTheme>;
}) {
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

function HintChip({
  keys,
  label,
  theme,
}: {
  keys: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
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
