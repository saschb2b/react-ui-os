"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { openContextMenu } from "./store";
import type { ContextMenuItem } from "./store";

interface AnchorProps {
  /** Items to show when the wrapped region is right-clicked. */
  items: ContextMenuItem[] | (() => ContextMenuItem[]);
  /** Accessibility label for the popped menu. */
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * Declarative wrapper. Right-clicking the wrapped child opens a context
 * menu at the cursor with the given items. Pass a function for `items`
 * if the menu contents depend on per-event state; it runs on every
 * right-click.
 *
 * Use the imperative `openContextMenu(...)` instead when you need
 * fine-grained control over the trigger (e.g. opening from a button
 * click, deriving items from selection across multiple regions).
 */
export function ContextMenuAnchor({ items, ariaLabel, children }: AnchorProps) {
  const child = Children.only(children);
  if (!isValidElement<{ onContextMenu?: (e: MouseEvent) => void }>(child)) {
    return <>{children}</>;
  }
  const existing = child.props.onContextMenu;
  const handler = (e: MouseEvent) => {
    existing?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const resolved = typeof items === "function" ? items() : items;
    if (resolved.length === 0) return;
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: resolved,
      ariaLabel,
      returnFocusTo: e.currentTarget instanceof HTMLElement ? e.currentTarget : null,
    });
  };
  return cloneElement(
    child as ReactElement<{ onContextMenu?: (e: MouseEvent) => void }>,
    {
      onContextMenu: handler,
    },
  );
}
