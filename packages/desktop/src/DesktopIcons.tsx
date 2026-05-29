"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useWindowManager } from "@react-ui-os/core";
import { useApps, useDesktopContext, useTheme } from "./desktop-context";
import { FolderSvg } from "./folder-svg";
import {
  listSystemWindows,
  resolveSystemWindowName,
  type SystemWindowDef,
} from "./system-windows";
import { nextIconIndex } from "./util/desktop-icon-nav";
import { pickInitialBounds } from "./util/initial-bounds";
import { getChromeMetrics } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

interface VisibleIcon {
  systemId: string;
  def: SystemWindowDef;
}

const ICON_TILE = 56;
const ICON_LABEL_GAP = 4;
const ICON_GAP = 18;
const EDGE_INSET = 14;

/** Stable DOM id per option, used for the listbox `aria-activedescendant`. */
function optionDomId(systemId: string): string {
  return `rui-desktop-icon-${systemId}`;
}

/**
 * Right-edge column of file-style desktop shortcuts. Renders one icon per
 * system window whose `appearsAsDesktopIcon` evaluates to true. Predicates
 * are re-checked whenever the storage adapter fires a change event, so a
 * Downloads or Presets folder appears the moment the user creates the
 * first item and disappears when they delete the last one.
 *
 * Interaction mirrors the macOS desktop, matching the selection model the
 * `FileExplorer` already implements:
 *
 *  - single click selects an icon
 *  - double click (or Enter on the selected icon) opens it
 *  - ArrowUp / ArrowDown move the selection within the column
 *  - Home / End jump to the first / last icon
 *  - Escape, or a click anywhere off the column, clears the selection
 *
 * The column is a WAI-ARIA listbox (`role="listbox"` + `role="option"`
 * with `aria-selected`), driven by `aria-activedescendant`, so the whole
 * column is a single tab stop and assistive tech announces the active icon.
 */
export function DesktopIcons() {
  const theme = useTheme();
  const apps = useApps();
  const { storage } = useDesktopContext();
  const { openWindow } = useWindowManager();
  const [visible, setVisible] = useState<VisibleIcon[]>(() => computeVisible(storage));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const recompute = () => {
      setVisible(computeVisible(storage));
    };
    recompute();
    const unsubscribe = storage.subscribe(() => {
      recompute();
    });
    return unsubscribe;
  }, [storage]);

  // Drop the selection if its icon disappeared (e.g. the last item was
  // deleted from a state-earned folder, so the predicate flips to false).
  useEffect(() => {
    setSelectedId((prev) =>
      prev && visible.some((v) => v.systemId === prev) ? prev : null,
    );
  }, [visible]);

  // Clicking anywhere off the column clears the selection, like the macOS
  // desktop. Only listen while something is selected.
  useEffect(() => {
    if (!selectedId) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = listboxRef.current;
      const target = e.target as HTMLElement | null;
      if (el && target && el.contains(target)) return;
      setSelectedId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [selectedId]);

  const openIcon = useCallback(
    (systemId: string) => {
      const payload = { kind: "system" as const, systemId };
      openWindow(payload, pickInitialBounds(payload, theme, apps));
    },
    [openWindow, theme, apps],
  );

  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const topInset =
    (theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0) + EDGE_INSET;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (visible.length === 0) return;
    const ids = visible.map((v) => v.systemId);
    const currentIdx = selectedId ? ids.indexOf(selectedId) : -1;
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      e.preventDefault();
      const next = nextIconIndex(currentIdx, e.key, ids.length);
      setSelectedId(ids[next] ?? null);
      return;
    }
    if (e.key === "Enter") {
      // macOS maps Return to rename and Cmd-Down to open, but these are
      // non-renameable system-window aliases and the FileExplorer already
      // binds Enter to open, so we follow that idiom.
      if (selectedId) {
        e.preventDefault();
        openIcon(selectedId);
      }
      return;
    }
    if (e.key === "Escape" && selectedId) {
      e.preventDefault();
      setSelectedId(null);
    }
  };

  if (visible.length === 0) return null;

  return (
    <div
      ref={listboxRef}
      role="listbox"
      aria-label="Desktop icons"
      aria-orientation="vertical"
      aria-activedescendant={selectedId ? optionDomId(selectedId) : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        top: topInset,
        right: EDGE_INSET,
        display: "flex",
        flexDirection: "column",
        gap: ICON_GAP,
        zIndex: 1,
        outline: "none",
      }}
    >
      {visible.map(({ systemId, def }) => (
        <DesktopShortcut
          key={systemId}
          systemId={systemId}
          def={def}
          selected={selectedId === systemId}
          onSelect={() => {
            setSelectedId(systemId);
            // Move focus to the listbox so the keyboard model and
            // aria-activedescendant announcement take effect.
            listboxRef.current?.focus();
          }}
          onOpen={() => {
            openIcon(systemId);
          }}
        />
      ))}
    </div>
  );
}

function DesktopShortcut({
  systemId,
  def,
  selected,
  onSelect,
  onOpen,
}: {
  systemId: string;
  def: SystemWindowDef;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const Icon = def.desktopIcon ?? FolderSvg;
  // The desktop shortcut opens the no-args instance of the system window,
  // so the icon label uses the name with `undefined` args.
  const label = resolveSystemWindowName(def);
  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
  };
  return (
    <div
      role="option"
      id={optionDomId(systemId)}
      aria-selected={selected}
      data-desktop-icon-id={systemId}
      title={label}
      onClick={handleClick}
      onDoubleClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: ICON_LABEL_GAP,
        width: ICON_TILE + 24,
        padding: "4px 0",
        borderRadius: theme.shape.small,
        background: selected ? `${theme.palette.accent}38` : "transparent",
        cursor: "pointer",
        color: theme.palette.textPrimary,
      }}
    >
      <div
        style={{
          width: ICON_TILE,
          height: ICON_TILE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={Math.round(ICON_TILE * 0.85)} />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          maxWidth: ICON_TILE + 24,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function computeVisible(
  storage: ReturnType<typeof useDesktopContext>["storage"],
): VisibleIcon[] {
  return listSystemWindows()
    .filter((entry) => {
      const cond = entry.appearsAsDesktopIcon;
      if (cond === undefined || cond === false) return false;
      if (cond === true) return true;
      try {
        return cond(storage);
      } catch {
        return false;
      }
    })
    .map(({ systemId, ...def }) => ({ systemId, def }));
}
