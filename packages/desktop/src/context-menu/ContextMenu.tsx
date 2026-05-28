"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useTheme } from "../desktop-context";
import {
  closeContextMenu,
  getContextMenuState,
  subscribeContextMenu,
  type ContextMenuItem,
  type ContextMenuState,
} from "./store";

const MARGIN = 8;
const MENU_WIDTH = 220;

/**
 * The visual surface for the context-menu store. Mount this once inside
 * `<DesktopProvider>` and any code can pop up a menu via
 * `openContextMenu({ x, y, items })`. `<Desktop>` mounts it for you.
 *
 * Closes on Esc, click outside, scroll, resize, window blur, or any new
 * contextmenu event somewhere else. Activating an item runs its onSelect
 * and then closes.
 */
export function ContextMenu() {
  const state = useSyncExternalStore(
    subscribeContextMenu,
    getContextMenuState,
    () => null,
  );

  useEffect(() => {
    if (!state) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeContextMenu();
      }
    };
    const handleScroll = () => closeContextMenu();
    const handleBlur = () => closeContextMenu();
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("blur", handleBlur);
    };
  }, [state]);

  if (!state) return null;

  return <Surface state={state} />;
}

function Surface({ state }: { state: ContextMenuState }) {
  const theme = useTheme();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: state.x,
    y: state.y,
  });
  const items = state.items;

  // Flip / clamp the menu after measuring so it never spills off-screen.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let x = state.x;
    let y = state.y;
    if (x + rect.width + MARGIN > viewportW) {
      x = Math.max(MARGIN, viewportW - rect.width - MARGIN);
    }
    if (y + rect.height + MARGIN > viewportH) {
      y = Math.max(MARGIN, viewportH - rect.height - MARGIN);
    }
    setPosition({ x, y });
  }, [state.x, state.y, items.length]);

  // Keyboard nav: focus first selectable item on mount, arrows traverse.
  const navItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !item.separator && !item.disabled);
  const [focusIdx, setFocusIdx] = useState<number>(
    navItems[0]?.idx ?? -1,
  );

  useEffect(() => {
    if (navItems.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const order = navItems.map((row) => row.idx);
        const cur = order.indexOf(focusIdx);
        const next = order[(cur + 1) % order.length];
        if (next !== undefined) setFocusIdx(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const order = navItems.map((row) => row.idx);
        const cur = order.indexOf(focusIdx);
        const next = order[(cur - 1 + order.length) % order.length];
        if (next !== undefined) setFocusIdx(next);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = items[focusIdx];
        if (item && !item.disabled && !item.separator) activate(item);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [focusIdx, items, navItems]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeContextMenu();
    }
  }, []);

  const surface: CSSProperties = {
    position: "fixed",
    top: position.y,
    left: position.x,
    minWidth: MENU_WIDTH,
    background: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.small + 4,
    boxShadow: "0 14px 36px -10px rgba(0,0,0,0.55)",
    padding: 4,
    zIndex: 1400,
    color: theme.palette.textPrimary,
    fontSize: 12,
    fontFamily: "inherit",
    visibility: position === undefined ? "hidden" : "visible",
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdrop}
      onContextMenu={(e) => {
        // Don't close — let the new contextmenu event hit window listeners.
        // But suppress the native browser menu.
        e.preventDefault();
        closeContextMenu();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1390,
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label={state.ariaLabel ?? "Context menu"}
        style={surface}
      >
        {items.map((item, idx) => {
          if (item.separator) {
            return (
              <div
                key={`sep-${String(idx)}`}
                role="separator"
                style={{
                  height: 1,
                  background: theme.palette.border,
                  margin: "4px 0",
                }}
              />
            );
          }
          const focused = idx === focusIdx;
          return (
            <Row
              key={`${item.label ?? "item"}-${String(idx)}`}
              item={item}
              focused={focused}
              onFocus={() => setFocusIdx(idx)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Row({
  item,
  focused,
  onFocus,
}: {
  item: ContextMenuItem;
  focused: boolean;
  onFocus: () => void;
}) {
  const theme = useTheme();
  const danger = item.danger;
  const baseColor = item.disabled
    ? theme.palette.textSecondary
    : danger
      ? "#ef4444"
      : theme.palette.textPrimary;
  const bg = focused ? theme.palette.border : "transparent";

  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onMouseEnter={onFocus}
      onClick={() => activate(item)}
      style={{
        appearance: "none",
        background: bg,
        border: 0,
        color: baseColor,
        padding: "5px 10px",
        borderRadius: 4,
        width: "100%",
        textAlign: "left",
        cursor: item.disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: item.disabled ? 0.55 : 1,
      }}
    >
      {item.icon && (
        <span aria-hidden style={{ width: 14, display: "inline-flex" }}>
          {item.icon}
        </span>
      )}
      <span style={{ flex: 1, whiteSpace: "nowrap" }}>{item.label}</span>
      {item.shortcut && (
        <span
          style={{
            color: theme.palette.textSecondary,
            fontVariantNumeric: "tabular-nums",
            fontSize: 11,
            marginLeft: 12,
          }}
        >
          {item.shortcut}
        </span>
      )}
    </button>
  );
}

function activate(item: ContextMenuItem): void {
  if (item.disabled || item.separator) return;
  item.onSelect?.();
  closeContextMenu();
}
