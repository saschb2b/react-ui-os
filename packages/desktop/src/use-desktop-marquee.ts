"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { marqueeFromPoints, marqueeIntersects, type MarqueeRect } from "./util/marquee";

// Pointer travel before a left-drag on the bare desktop becomes a marquee, so
// a plain click that just clears the selection never flashes a rectangle.
const MARQUEE_THRESHOLD_PX = 4;

/**
 * True when a pointer event landed on the bare desktop, not on a window, the
 * dock, the menu bar, a context-menu region, or a form field. The icon column
 * is handled separately by the caller. The marquee only begins here, the same
 * surface where the desktop right-click menu is allowed to open.
 */
function isBareDesktop(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (
    target.closest("[data-rui-window]") ||
    target.closest("[data-rui-dock]") ||
    target.closest("[data-rui-menubar]") ||
    target.closest("[data-rui-context-region]")
  ) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return !(tag === "input" || tag === "textarea" || target.isContentEditable);
}

/** Ids of the desktop icons inside `container` whose tiles overlap `rect`. */
function iconsInMarquee(rect: MarqueeRect, container: HTMLElement | null): string[] {
  if (!container) return [];
  const ids: string[] = [];
  container.querySelectorAll<HTMLElement>("[data-desktop-icon-id]").forEach((el) => {
    const id = el.getAttribute("data-desktop-icon-id");
    if (id && marqueeIntersects(rect, el.getBoundingClientRect())) ids.push(id);
  });
  return ids;
}

interface UseDesktopMarqueeOptions {
  /** The icon column. Queried for the tiles a marquee covers, and used to tell
   *  a click inside the column from one on the bare desktop. */
  containerRef: RefObject<HTMLElement | null>;
  /** Current selection, read so an outside click only clears when something is selected. */
  selectedIds: Set<string>;
  /** Replace the selection with these icon ids (the last becomes active). */
  selectIcons: (ids: string[]) => void;
  /** Clear the whole selection. */
  clearSelection: () => void;
}

/**
 * The desktop's bare-area pointer interaction, in one place. Returns the live
 * marquee rectangle for the caller to paint, or null when no sweep is running.
 *
 *  - a left drag sweeps a rubber-band marquee that selects the icons it covers
 *  - holding Shift / Cmd / Ctrl adds the sweep to the existing selection
 *  - Escape, or pressing the right button mid-sweep, cancels and restores it
 *  - a plain click clears the selection; a click on a window or the dock too
 *  - keyboard focus lands on the icon column after a sweep that selected
 *
 * One document `pointerdown` listener drives all of it; the latest props are
 * reached through a ref so the listener attaches once.
 */
export function useDesktopMarquee({
  containerRef,
  selectedIds,
  selectIcons,
  clearSelection,
}: UseDesktopMarqueeOptions): MarqueeRect | null {
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const latest = useRef({ selectedIds, selectIcons, clearSelection });
  latest.current = { selectedIds, selectIcons, clearSelection };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // Clicks inside the icon column are the icons' own to handle.
      if (containerRef.current?.contains(target)) return;
      if (!isBareDesktop(target)) {
        // A click on a window, the dock, or the menu bar drops the selection,
        // like the macOS desktop.
        if (latest.current.selectedIds.size > 0) latest.current.clearSelection();
        return;
      }
      if (e.button !== 0) return; // right-drag belongs to the context menu

      const x0 = e.clientX;
      const y0 = e.clientY;
      // Shift / Cmd / Ctrl held at the start adds the sweep to whatever was
      // already selected, the way macOS and Windows extend a selection. The
      // selection present at the start is also what a cancel restores, so it is
      // captured either way.
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const base = new Set(latest.current.selectedIds);
      let dragging = false;
      let lastApplied: string[] = [];

      const teardown = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("contextmenu", onContextMenu, true);
        window.removeEventListener("keydown", onKey, true);
        document.body.style.userSelect = "";
        setMarquee(null);
      };

      // Abort the sweep and put the selection back where it started.
      const cancel = () => {
        if (dragging) latest.current.selectIcons(Array.from(base));
        teardown();
      };

      const onMove = (ev: PointerEvent) => {
        if (
          !dragging &&
          Math.hypot(ev.clientX - x0, ev.clientY - y0) < MARQUEE_THRESHOLD_PX
        ) {
          return;
        }
        dragging = true;
        document.body.style.userSelect = "none";
        const rect = marqueeFromPoints(x0, y0, ev.clientX, ev.clientY);
        setMarquee(rect);
        const swept = iconsInMarquee(rect, containerRef.current);
        lastApplied = additive ? Array.from(new Set([...base, ...swept])) : swept;
        latest.current.selectIcons(lastApplied);
      };

      const onUp = () => {
        teardown();
        if (!dragging) {
          // A plain click clears; a modifier-held click keeps the selection.
          if (!additive && latest.current.selectedIds.size > 0) {
            latest.current.clearSelection();
          }
          return;
        }
        // After a sweep that selected something, keyboard focus lands on the
        // desktop so the arrow keys work immediately.
        if (lastApplied.length > 0) containerRef.current?.focus();
      };

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape" && dragging) {
          ev.preventDefault();
          ev.stopPropagation(); // don't let it also restore a maximized window
          cancel();
        }
      };

      // A right-click mid-sweep aborts it (Windows). Swallow that context menu
      // so the abort is clean; a right-click with no sweep underway is left to
      // open the desktop menu as usual.
      const onContextMenu = (ev: MouseEvent) => {
        if (!dragging) return;
        ev.preventDefault();
        ev.stopPropagation();
        cancel();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("contextmenu", onContextMenu, true);
      window.addEventListener("keydown", onKey, true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [containerRef]);

  return marquee;
}
