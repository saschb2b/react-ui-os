"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useTheme } from "../desktop-context";

/**
 * Lightweight themed tooltip. Wraps a single child and shows a small
 * dark pill near it after a hover delay. Replaces the native `title`
 * attribute on every dock tile, traffic light, workspace pip, and clock
 * in the library: same visual stance, support for an optional shortcut
 * hint, and no layout jank when the tooltip would overflow the viewport.
 *
 * "Warm" behavior: once a tooltip has shown in the last 800 ms, the
 * next one shows without delay. Mirrors the macOS / web platform
 * convention so a user moving between tiles doesn't re-pay the delay.
 */

const SHOW_DELAY_COLD = 480;
const SHOW_DELAY_WARM = 60;
const HIDE_GRACE_PERIOD = 800;
const OFFSET = 8;

interface TooltipProps {
  /** The label rendered in the body. Use short, glanceable copy. */
  text: string;
  /** Optional shortcut hint shown on the right side ("⌘K", "F3", "↵"). */
  shortcut?: string;
  /** Preferred edge. Tooltip flips if it would clip. Default "top". */
  placement?: "top" | "bottom" | "left" | "right";
  /** Disable the tooltip without unwrapping the child. */
  disabled?: boolean;
  /** Single child. Must accept onPointerEnter / onPointerLeave / onFocus / onBlur. */
  children: ReactNode;
}

let lastHiddenAt = 0;

interface ChildHandlers {
  onPointerEnter?: (e: ReactMouseEvent) => void;
  onPointerLeave?: (e: ReactMouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
}

export function Tooltip({
  text,
  shortcut,
  placement = "top",
  disabled = false,
  children,
}: TooltipProps) {
  const child = Children.only(children);
  if (!isValidElement(child)) {
    return <>{children}</>;
  }
  return (
    <TooltipImpl
      text={text}
      shortcut={shortcut}
      placement={placement}
      disabled={disabled}
      child={child as ReactElement<ChildHandlers>}
    />
  );
}

function TooltipImpl({
  text,
  shortcut,
  placement,
  disabled,
  child,
}: {
  text: string;
  shortcut?: string;
  placement: NonNullable<TooltipProps["placement"]>;
  disabled: boolean;
  child: ReactElement<ChildHandlers>;
}) {
  const [visible, setVisible] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelShow = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const onEnter = () => {
    if (disabled) return;
    cancelShow();
    const now = Date.now();
    const warm = now - lastHiddenAt < HIDE_GRACE_PERIOD;
    const delay = warm ? SHOW_DELAY_WARM : SHOW_DELAY_COLD;
    showTimerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const onLeave = () => {
    cancelShow();
    if (visible) {
      lastHiddenAt = Date.now();
      setVisible(false);
    }
  };

  useEffect(
    () => () => {
      cancelShow();
    },
    [],
  );

  const childProps = child.props;
  const wrappedChild = cloneElement<ChildHandlers & { ref?: React.Ref<HTMLElement> }>(
    child as ReactElement<ChildHandlers & { ref?: React.Ref<HTMLElement> }>,
    {
      onPointerEnter: (e: ReactMouseEvent) => {
        childProps.onPointerEnter?.(e);
        onEnter();
      },
      onPointerLeave: (e: ReactMouseEvent) => {
        childProps.onPointerLeave?.(e);
        onLeave();
      },
      onFocus: (e: React.FocusEvent) => {
        childProps.onFocus?.(e);
        onEnter();
      },
      onBlur: (e: React.FocusEvent) => {
        childProps.onBlur?.(e);
        onLeave();
      },
      ref: (node: HTMLElement | null) => {
        anchorRef.current = node;
        const existingRef = (child as { ref?: React.Ref<HTMLElement> }).ref;
        if (typeof existingRef === "function") existingRef(node);
        else if (existingRef && typeof existingRef === "object") {
          (existingRef as React.RefObject<HTMLElement | null>).current = node;
        }
      },
    },
  );

  return (
    <>
      {wrappedChild}
      {visible && anchorRef.current && (
        <TooltipSurface
          anchor={anchorRef.current}
          text={text}
          shortcut={shortcut}
          placement={placement}
        />
      )}
    </>
  );
}

function TooltipSurface({
  anchor,
  text,
  shortcut,
  placement,
}: {
  anchor: HTMLElement;
  text: string;
  shortcut?: string;
  placement: "top" | "bottom" | "left" | "right";
}) {
  const theme = useTheme();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; place: typeof placement }>({
    x: 0,
    y: 0,
    place: placement,
  });

  useLayoutEffect(() => {
    const update = () => {
      const el = surfaceRef.current;
      if (!el) return;
      const a = anchor.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      const margin = 6;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      let place = placement;
      let x = 0;
      let y = 0;

      const calc = (where: typeof placement) => {
        switch (where) {
          case "top":
            return {
              x: a.left + a.width / 2 - t.width / 2,
              y: a.top - t.height - OFFSET,
            };
          case "bottom":
            return {
              x: a.left + a.width / 2 - t.width / 2,
              y: a.bottom + OFFSET,
            };
          case "left":
            return {
              x: a.left - t.width - OFFSET,
              y: a.top + a.height / 2 - t.height / 2,
            };
          case "right":
            return {
              x: a.right + OFFSET,
              y: a.top + a.height / 2 - t.height / 2,
            };
        }
      };

      ({ x, y } = calc(place));

      // Flip if we'd clip.
      const wouldClip = () =>
        x < margin ||
        y < margin ||
        x + t.width + margin > viewportW ||
        y + t.height + margin > viewportH;

      if (wouldClip()) {
        const flip: Record<typeof placement, typeof placement> = {
          top: "bottom",
          bottom: "top",
          left: "right",
          right: "left",
        };
        const alt = calc(flip[place]);
        x = alt.x;
        y = alt.y;
        place = flip[place];
      }

      // Final clamp so the tooltip never sits off-screen.
      x = Math.max(margin, Math.min(x, viewportW - t.width - margin));
      y = Math.max(margin, Math.min(y, viewportH - t.height - margin));

      setPos({ x, y, place });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor, placement, text, shortcut]);

  const surfaceStyle: CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    background: "rgba(20, 22, 32, 0.92)",
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    color: "#f1f3f8",
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: theme.shape.small + 2,
    padding: "5px 10px",
    fontSize: 11,
    fontFamily: "inherit",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 2000,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
  };

  return (
    <div ref={surfaceRef} role="tooltip" style={surfaceStyle}>
      <span>{text}</span>
      {shortcut && (
        <span
          style={{
            color: "rgba(241, 243, 248, 0.55)",
            fontVariantNumeric: "tabular-nums",
            fontSize: 10,
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
}
