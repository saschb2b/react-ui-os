"use client";

import { useEffect } from "react";
import { useWindowManager } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import {
  closeContextMenu,
  openContextMenu,
  type ContextMenuItem,
} from "./context-menu";
import { nextCascadeIndex, pickInitialBounds } from "./util/initial-bounds";
import { NOTIFICATION_CENTER_TOGGLE_EVENT, SPOTLIGHT_OPEN_EVENT } from "./events";

interface DesktopBackdropProps {
  /** Extra items appended to the default set. */
  extraItems?: ContextMenuItem[];
  /**
   * Override the default items entirely. Receives the default items so the
   * consumer can decide which to keep, drop, or sandwich around custom ones.
   */
  buildItems?: (defaultItems: ContextMenuItem[]) => ContextMenuItem[];
}

/**
 * Catches right-clicks on the desktop background and pops a system menu.
 * Uses a document-level capture-phase listener and bails out when the
 * click landed inside a window, dock, menu bar, or other interactive
 * surface. Anything that already has its own context menu (or a sane
 * "nothing" behavior) keeps it.
 *
 * Default items surface system entry points: Spotlight, Notifications,
 * Settings, Show Desktop. Extend with `extraItems` for app-specific
 * commands (Change wallpaper, Sort icons), or replace wholesale with
 * `buildItems`.
 *
 * Mounted by `<Desktop>` automatically. Mount manually inside a
 * `<DesktopProvider>` composition if you want it but with a custom
 * item set.
 */
export function DesktopBackdrop({ extraItems, buildItems }: DesktopBackdropProps = {}) {
  const { state, windows, minimizeWindow, openWindow } = useWindowManager();
  const theme = useTheme();
  const apps = useApps();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Bail when the event landed inside a region with its own menu:
      // the FileExplorer, anything wrapped in ContextMenuAnchor, etc.
      if (target.closest("[data-rui-context-region]")) return;
      // Bail when the event landed inside a real window or system chrome.
      // Those have their own contextmenu handlers or intentionally none.
      if (target.closest("[data-rui-window]")) return;
      if (target.closest("[data-rui-dock]")) return;
      if (target.closest("[data-rui-menubar]")) return;
      // Don't fight form controls.
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target.isContentEditable) {
        return;
      }

      e.preventDefault();

      const defaultItems: ContextMenuItem[] = [
        {
          label: "Spotlight",
          shortcut: "⌘K",
          onSelect: () => {
            window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT));
          },
        },
        {
          label: "Notifications",
          onSelect: () => {
            window.dispatchEvent(new CustomEvent(NOTIFICATION_CENTER_TOGGLE_EVENT));
          },
        },
        { separator: true },
        {
          label: "System Settings",
          shortcut: "⌘,",
          onSelect: () => {
            const payload = { kind: "system" as const, systemId: "settings" };
            openWindow(
              payload,
              pickInitialBounds(
                payload,
                theme,
                apps,
                undefined,
                nextCascadeIndex(state),
              ),
            );
          },
        },
        {
          label: "Show Desktop",
          disabled: windows.every((w) => w.state === "minimized"),
          onSelect: () => {
            for (const w of windows) {
              if (w.state !== "minimized") minimizeWindow(w.id);
            }
          },
        },
      ];

      const items = buildItems
        ? buildItems(defaultItems)
        : extraItems
          ? [...defaultItems, { separator: true }, ...extraItems]
          : defaultItems;

      if (items.length === 0) return;

      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        items,
        ariaLabel: "Desktop",
      });
    };

    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("contextmenu", handler);
      // Close on unmount so a stale menu doesn't linger when the consumer
      // toggles the backdrop off.
      closeContextMenu();
    };
  }, [state, windows, minimizeWindow, openWindow, theme, apps, extraItems, buildItems]);

  return null;
}
