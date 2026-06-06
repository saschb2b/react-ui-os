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
import { openContextMenu } from "./context-menu";
import { useApps, useDesktopContext, useTheme } from "./desktop-context";
import { FolderSvg } from "./folder-svg";
import {
  listSystemWindows,
  resolveSystemWindowName,
  type SystemWindowDef,
} from "./system-windows";
import { useDesktopMarquee } from "./use-desktop-marquee";
import { nextIconIndex } from "./util/desktop-icon-nav";
import { nextCascadeIndex, pickInitialBounds } from "./util/initial-bounds";
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
 * Right-edge column of file-style desktop shortcuts plus the desktop's
 * rubber-band marquee. Renders one icon per system window whose
 * `appearsAsDesktopIcon` evaluates to true. Predicates are re-checked whenever
 * the storage adapter fires a change event, so a Downloads or Presets folder
 * appears the moment the user creates the first item and disappears when they
 * delete the last one.
 *
 * Interaction mirrors the macOS desktop, matching the selection model the
 * `FileExplorer` already implements:
 *
 *  - single click selects an icon; Cmd/Ctrl click toggles; Shift click extends
 *  - double click (or Enter on the active icon) opens it
 *  - a left drag on the bare desktop sweeps a marquee that selects the icons
 *    it covers; a click on bare desktop, or Escape, clears the selection
 *  - ArrowUp / ArrowDown move the selection; Home / End jump to first / last;
 *    Cmd/Ctrl+A selects every icon
 *
 * The column is a WAI-ARIA multi-select listbox driven by
 * `aria-activedescendant`, so the whole column is a single tab stop and
 * assistive tech announces the active icon. The component always mounts (even
 * with no icons) so the marquee works on an empty desktop.
 */
export function DesktopIcons() {
  const theme = useTheme();
  const apps = useApps();
  const { storage } = useDesktopContext();
  const { state, openWindow } = useWindowManager();
  const [visible, setVisible] = useState<VisibleIcon[]>(() => computeVisible(storage));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // Drop selection / active ids whose icon disappeared (e.g. the last item was
  // deleted from a state-earned folder, so the predicate flips to false).
  useEffect(() => {
    const ids = new Set(visible.map((v) => v.systemId));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
    setActiveId((prev) => (prev && ids.has(prev) ? prev : null));
  }, [visible]);

  const selectIcons = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setActiveId(ids.length > 0 ? (ids[ids.length - 1] ?? null) : null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setActiveId(null);
  }, []);

  // Bare-desktop pointer behavior: left-drag marquee, click-to-clear, and
  // click-a-window-to-clear all live in this one hook.
  const marquee = useDesktopMarquee({
    containerRef: listboxRef,
    selectedIds,
    selectIcons,
    clearSelection,
  });

  const openIcon = useCallback(
    (systemId: string) => {
      const payload = { kind: "system" as const, systemId };
      openWindow(
        payload,
        pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
      );
    },
    [openWindow, theme, apps, state],
  );

  const selectIcon = useCallback(
    (systemId: string, modifiers: { toggle?: boolean; range?: boolean }) => {
      if (modifiers.range && activeId) {
        const ids = visible.map((v) => v.systemId);
        const a = ids.indexOf(activeId);
        const b = ids.indexOf(systemId);
        if (a >= 0 && b >= 0) {
          const [from, to] = a <= b ? [a, b] : [b, a];
          const next = new Set<string>();
          for (let i = from; i <= to; i++) {
            const id = ids[i];
            if (id) next.add(id);
          }
          setSelectedIds(next);
          return;
        }
      }
      if (modifiers.toggle) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(systemId)) next.delete(systemId);
          else next.add(systemId);
          return next;
        });
        setActiveId(systemId);
        return;
      }
      setSelectedIds(new Set([systemId]));
      setActiveId(systemId);
    },
    [activeId, visible],
  );

  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const topInset =
    (theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0) + EDGE_INSET;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (visible.length === 0) return;
    const ids = visible.map((v) => v.systemId);
    // Cmd/Ctrl+A selects every icon.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selectIcons(ids);
      return;
    }
    const currentIdx = activeId ? ids.indexOf(activeId) : -1;
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      e.preventDefault();
      const next = nextIconIndex(currentIdx, e.key, ids.length);
      const id = ids[next];
      selectIcons(id ? [id] : []);
      return;
    }
    if (e.key === "Enter") {
      // macOS maps Return to rename and Cmd-Down to open, but these are
      // non-renameable system-window aliases and the FileExplorer already
      // binds Enter to open, so we follow that idiom.
      if (activeId) {
        e.preventDefault();
        openIcon(activeId);
      }
      return;
    }
    if (e.key === "Escape" && selectedIds.size > 0) {
      e.preventDefault();
      clearSelection();
    }
  };

  return (
    <>
      {visible.length > 0 && (
        <div
          ref={listboxRef}
          role="listbox"
          aria-label="Desktop icons"
          aria-orientation="vertical"
          aria-multiselectable
          aria-activedescendant={activeId ? optionDomId(activeId) : undefined}
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
              selected={selectedIds.has(systemId)}
              onSelect={(modifiers) => {
                selectIcon(systemId, modifiers);
                // Move focus to the listbox so the keyboard model and
                // aria-activedescendant announcement take effect.
                listboxRef.current?.focus();
              }}
              onOpen={() => {
                openIcon(systemId);
              }}
              onContextMenu={(x, y) => {
                if (!selectedIds.has(systemId)) selectIcon(systemId, {});
                listboxRef.current?.focus();
                openContextMenu({
                  x,
                  y,
                  ariaLabel: resolveSystemWindowName(def),
                  items: [
                    {
                      label: "Open",
                      shortcut: "↵",
                      onSelect: () => {
                        openIcon(systemId);
                      },
                    },
                  ],
                  returnFocusTo: listboxRef.current,
                });
              }}
            />
          ))}
        </div>
      )}
      {marquee && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
            // Functional selection affordance, matched to the snap preview:
            // an accent wash with a hairline accent border.
            background: `${theme.palette.accent}22`,
            border: `1px solid ${theme.palette.accent}99`,
            borderRadius: theme.shape.small,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
    </>
  );
}

function DesktopShortcut({
  systemId,
  def,
  selected,
  onSelect,
  onOpen,
  onContextMenu,
}: {
  systemId: string;
  def: SystemWindowDef;
  selected: boolean;
  onSelect: (modifiers: { toggle?: boolean; range?: boolean }) => void;
  onOpen: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const theme = useTheme();
  const Icon = def.desktopIcon ?? FolderSvg;
  // The desktop shortcut opens the no-args instance of the system window,
  // so the icon label uses the name with `undefined` args.
  const label = resolveSystemWindowName(def);
  // The label sits on the wallpaper, not a themed surface, so it can't rely on
  // the theme's text color: a light theme's near-black text vanishes on a dark
  // wallpaper. Over a wallpaper, use white with a dark shadow (the macOS /
  // Windows desktop treatment, readable on any image); with no wallpaper the
  // solid background is the theme's, so the theme text color is right.
  const onWallpaper = Boolean(theme.wallpaper.src);
  const labelColor = onWallpaper ? "#fff" : theme.palette.textPrimary;
  const labelShadow = onWallpaper ? "0 1px 3px rgba(0,0,0,0.8)" : "none";
  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect({ toggle: e.metaKey || e.ctrlKey, range: e.shiftKey });
  };
  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Keep the right-click from bubbling to the document-level
    // DesktopBackdrop handler, so the icon shows its own menu instead of
    // the generic desktop menu. Right-clicks in the column gaps still
    // fall through to the desktop menu, matching macOS.
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e.clientX, e.clientY);
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
      onContextMenu={handleContextMenu}
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
          color: labelColor,
          textShadow: labelShadow,
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
