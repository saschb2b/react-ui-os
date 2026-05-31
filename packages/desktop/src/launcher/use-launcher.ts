"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { App } from "@react-ui-os/core";
import { useWindowManager } from "@react-ui-os/core";
import { useApps, useTheme } from "../desktop-context";
import { nextCascadeIndex, pickInitialBounds } from "../util/initial-bounds";
import { SPOTLIGHT_OPEN_EVENT } from "../events";
import {
  listSystemWindows,
  resolveSystemWindowName,
  type SystemWindowDef,
} from "../system-windows";
import { listSpotlightSources, subscribeSpotlightSources } from "../spotlight-sources";

// `process.env.NODE_ENV` is the bundler-agnostic dev/prod switch: bundlers
// replace this exact expression at build time and tree-shake the warning
// below out of production. This package targets the browser and does not
// depend on @types/node, so type just the one global we read rather than
// pull Node's globals into a browser package. TS 6 stopped auto-including
// @types/node anyway (`types` now defaults to `[]`).
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/** One launcher result: a registered app, a system window, or an external source row. */
export type LauncherResult =
  | {
      kind: "app";
      key: string;
      name: string;
      tagline?: string;
      accent?: string;
      icon?: ReactNode;
      app: App;
    }
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

export interface LauncherState {
  /** Whether the launcher is currently shown. */
  open: boolean;
  /** Current search text. */
  query: string;
  setQuery: (q: string) => void;
  /** Filtered, ordered results (apps, system windows, then external sources). */
  results: LauncherResult[];
  /** Index of the highlighted result. */
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  /** Move the highlight by `delta`, wrapping around the result list. */
  moveSelection: (delta: number) => void;
  /** Open (focus-restoring), close, or activate a result and close. */
  openLauncher: () => void;
  close: () => void;
  activate: (result: LauncherResult) => void;
  /** Activate the currently highlighted result. */
  activateSelected: () => void;
}

/**
 * The shared brain of every launcher presentation. Owns open/close state, the
 * query, the merged result set (apps + system windows + `registerSpotlightSource`
 * rows), selection, and activation, plus the global Cmd/Ctrl+K toggle and the
 * `SPOTLIGHT_OPEN_EVENT` listener. The three built-in presentations
 * (`"spotlight"`, `"grid"`, `"menu"`) are thin views over this hook; consumers
 * can build a fully custom launcher the same way.
 *
 * Activating a result calls `openWindow(...)`, the same primitive a dock click
 * uses, so the shortest path from "I typed three letters" to "the right window
 * is on top" reuses the system's existing plumbing.
 */
export function useLauncher(): LauncherState {
  const theme = useTheme();
  const apps = useApps();
  const { state, openWindow } = useWindowManager();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const openLauncher = useCallback(() => {
    previousFocusRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    setQuery("");
    setSelectedIndex(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
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
          (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (inField) return;
        e.preventDefault();
        openLauncher();
        return;
      }
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, openLauncher, close]);

  useEffect(() => {
    const onOpenEvt = () => {
      if (!open) openLauncher();
    };
    window.addEventListener(SPOTLIGHT_OPEN_EVENT, onOpenEvt);
    return () => {
      window.removeEventListener(SPOTLIGHT_OPEN_EVENT, onOpenEvt);
    };
  }, [open, openLauncher]);

  // Re-render whenever a source registers / unregisters. The hook returns an
  // opaque token; we only need its referential change.
  const sourcesVersion = useSyncExternalStore(
    subscribeSpotlightSources,
    () => listSpotlightSources().length,
    () => 0,
  );

  const results = useMemo<LauncherResult[]>(() => {
    void sourcesVersion;
    const appResults: LauncherResult[] = apps.map((app) => ({
      kind: "app",
      key: `app:${app.id}`,
      name: app.name,
      tagline: app.tagline,
      accent: app.accent,
      app,
    }));
    const systemResults: LauncherResult[] = listSystemWindows().map((sys) => ({
      kind: "system",
      key: `system:${sys.systemId}`,
      name: resolveSystemWindowName(sys),
      tagline: sys.tagline,
      accent: sys.accent,
      systemId: sys.systemId,
      def: sys,
    }));
    const q = query.trim().toLowerCase();
    // Sources receive the trimmed query; they decide how to filter their own
    // data. Each result is tagged with the source id to avoid clashes.
    const externalResults: LauncherResult[] = listSpotlightSources().flatMap(
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
        } catch (err) {
          // A misbehaving source should not bring down the launcher. We warn in
          // development so the consumer can see why their source isn't
          // appearing; production silently drops the source for that call.
          if (
            typeof process !== "undefined" &&
            process.env?.NODE_ENV !== "production"
          ) {
            console.warn("[react-ui-os] launcher source threw:", err);
          }
          return [];
        }
      },
    );
    const builtIn: LauncherResult[] = [...appResults, ...systemResults];
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

  const activate = useCallback(
    (result: LauncherResult) => {
      if (result.kind === "app") {
        const payload = { kind: "app" as const, appId: result.app.id };
        openWindow(
          payload,
          pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
        );
      } else if (result.kind === "system") {
        const payload = { kind: "system" as const, systemId: result.systemId };
        openWindow(
          payload,
          pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
        );
      } else {
        result.onActivate();
      }
      close();
    },
    [apps, openWindow, close, theme, state],
  );

  const moveSelection = useCallback(
    (delta: number) => {
      setSelectedIndex((idx) => {
        if (results.length === 0) return 0;
        return (idx + delta + results.length) % results.length;
      });
    },
    [results.length],
  );

  const activateSelected = useCallback(() => {
    const target = results[selectedIndex];
    if (target) activate(target);
  }, [results, selectedIndex, activate]);

  return {
    open,
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    moveSelection,
    openLauncher,
    close,
    activate,
    activateSelected,
  };
}
