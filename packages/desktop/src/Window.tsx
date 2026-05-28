"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWindowManager } from "@react-ui-os/core";
import type { OpenWindow } from "@react-ui-os/core";
import { useApp, useTheme } from "./desktop-context";
import { MENU_BAR_HEIGHT } from "./MenuBar";
import { DOCK_HEIGHT, getDockTileRect } from "./Dock";
import { clampWindowToWorkArea } from "./util/clamp";

const TITLE_BAR_HEIGHT = 32;

interface WindowProps {
  win: OpenWindow;
}

type AnimationPhase = "idle" | "opening" | "closing" | "minimizing";

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

/**
 * One window. Renders the chrome (title bar with traffic lights) plus the
 * app content. Drag writes the transform directly to the DOM during the
 * gesture and only commits to React state on pointerup, so dragging four
 * windows with live content stays at 60 fps.
 */
export function Window({ win }: WindowProps) {
  const theme = useTheme();
  const {
    focusedWindow,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    setBounds,
  } = useWindowManager();
  const focused = focusedWindow?.id === win.id;

  const appPayload =
    win.payload.kind === "app" ? win.payload.appId : undefined;
  const app = useApp(appPayload ?? "__none__");

  const elRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>("opening");

  // After the open animation finishes, drop the phase so subsequent re-renders
  // don't replay it. Tied to the theme's window-open duration.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPhase("idle");
    }, theme.motion.windowOpenDurationMs + 40);
    return () => {
      window.clearTimeout(id);
    };
  }, [theme.motion.windowOpenDurationMs]);

  const handleClose = useCallback(() => {
    setPhase("closing");
    const t = window.setTimeout(() => {
      closeWindow(win.id);
    }, theme.motion.windowOpenDurationMs);
    return () => {
      window.clearTimeout(t);
    };
  }, [closeWindow, theme.motion.windowOpenDurationMs, win.id]);

  const handleMinimize = useCallback(() => {
    const el = elRef.current;
    const dockRect = appPayload ? getDockTileRect(appPayload) : null;
    if (el && dockRect) {
      const winRect = el.getBoundingClientRect();
      const dx = dockRect.left + dockRect.width / 2 - (winRect.left + winRect.width / 2);
      const dy = dockRect.top + dockRect.height / 2 - (winRect.top + winRect.height / 2);
      el.style.setProperty("--genie-dx", `${String(dx)}px`);
      el.style.setProperty("--genie-dy", `${String(dy)}px`);
    }
    setPhase("minimizing");
    const t = window.setTimeout(() => {
      minimizeWindow(win.id);
      setPhase("idle");
    }, theme.motion.genieDurationMs);
    return () => {
      window.clearTimeout(t);
    };
  }, [appPayload, minimizeWindow, theme.motion.genieDurationMs, win.id]);

  const handleMaximize = useCallback(() => {
    toggleMaximize(win.id);
  }, [toggleMaximize, win.id]);

  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (win.state === "maximized") return;
      focusWindow(win.id);
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: win.x,
        startY: win.y,
        lastX: win.x,
        lastY: win.y,
      };
    },
    [focusWindow, win.id, win.state, win.x, win.y],
  );

  const moveDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const targetX = drag.startX + (e.clientX - drag.startClientX);
      const targetY = drag.startY + (e.clientY - drag.startClientY);
      const clamped = clampWindowToWorkArea(targetX, targetY, win.w, win.h, {
        width: window.innerWidth,
        height: window.innerHeight - MENU_BAR_HEIGHT - DOCK_HEIGHT,
      });
      drag.lastX = clamped.x;
      drag.lastY = clamped.y;
      const el = elRef.current;
      if (el) {
        el.style.transform = `translate3d(${String(clamped.x)}px, ${String(clamped.y)}px, 0)`;
      }
    },
    [win.w, win.h],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      setBounds(win.id, drag.lastX, drag.lastY, win.w, win.h);
      dragRef.current = null;
    },
    [setBounds, win.id, win.w, win.h],
  );

  const maximized = win.state === "maximized";

  const baseTransform = maximized
    ? "translate3d(0, 0, 0)"
    : `translate3d(${String(win.x)}px, ${String(win.y)}px, 0)`;

  const animationStyle =
    phase === "opening"
      ? {
          animation: `rui-window-open ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
        }
      : phase === "closing"
        ? {
            animation: `rui-window-close ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing} both`,
          }
        : phase === "minimizing"
          ? {
              animation: `rui-window-genie ${String(theme.motion.genieDurationMs)}ms ${theme.motion.genieEasing} both`,
            }
          : {};

  if (win.state === "minimized" && phase !== "minimizing") return null;

  return (
    <div
      ref={elRef}
      role="region"
      aria-label={app?.name ? `${app.name} window` : "Window"}
      onPointerDown={() => {
        if (!focused) focusWindow(win.id);
      }}
      style={{
        position: "fixed",
        left: 0,
        top: MENU_BAR_HEIGHT,
        width: maximized ? "100vw" : win.w,
        height: maximized
          ? `calc(100vh - ${String(MENU_BAR_HEIGHT)}px - ${String(DOCK_HEIGHT + 14)}px)`
          : win.h,
        transform: baseTransform,
        backgroundColor: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        border: `1px solid ${theme.palette.border}`,
        borderRadius: maximized ? 0 : theme.shape.windowRadius,
        boxShadow: focused
          ? "0 20px 50px -12px rgba(0,0,0,0.55), 0 8px 18px -6px rgba(0,0,0,0.35)"
          : "0 10px 24px -8px rgba(0,0,0,0.4)",
        color: theme.palette.textPrimary,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 100 + win.z,
        ...animationStyle,
      }}
    >
      <TitleBar
        title={app?.name ?? "Window"}
        focused={focused}
        accent={app?.accent ?? theme.palette.accent}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleMaximize}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: 16,
        }}
      >
        {app ? <app.content appId={app.id} focused={focused} /> : null}
      </div>
    </div>
  );
}

interface TitleBarProps {
  title: string;
  focused: boolean;
  accent: string;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

function TitleBar({
  title,
  focused,
  accent,
  onClose,
  onMinimize,
  onMaximize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
}: TitleBarProps) {
  const theme = useTheme();
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      style={{
        position: "relative",
        height: TITLE_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        borderBottom: `1px solid ${theme.palette.border}`,
        userSelect: "none",
        cursor: "grab",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: focused
            ? `linear-gradient(90deg, transparent, ${accent}, transparent)`
            : "transparent",
          opacity: 0.75,
        }}
      />
      <TrafficLights
        focused={focused}
        onClose={onClose}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
      />
      <span
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: focused
            ? theme.palette.textPrimary
            : theme.palette.textSecondary,
        }}
      >
        {title}
      </span>
      <span style={{ width: 60 }} aria-hidden />
    </div>
  );
}

function TrafficLights({
  focused,
  onClose,
  onMinimize,
  onMaximize,
}: {
  focused: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => {
        // Don't let traffic-light clicks bubble up to start a window drag.
        e.stopPropagation();
      }}
      style={{ display: "flex", gap: 6 }}
    >
      <TrafficLight color="#ff5f57" hoverGlyph="x" onClick={onClose} focused={focused} />
      <TrafficLight color="#febc2e" hoverGlyph="-" onClick={onMinimize} focused={focused} />
      <TrafficLight color="#28c840" hoverGlyph="+" onClick={onMaximize} focused={focused} />
    </div>
  );
}

function TrafficLight({
  color,
  hoverGlyph,
  onClick,
  focused,
}: {
  color: string;
  hoverGlyph: string;
  onClick: () => void;
  focused: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        background: focused ? color : "#555",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        fontFamily: "system-ui, sans-serif",
        fontSize: 10,
        lineHeight: 1,
        color: "rgba(0,0,0,0.6)",
        boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)",
      }}
      aria-label={hoverGlyph === "x" ? "Close" : hoverGlyph === "-" ? "Minimize" : "Maximize"}
    >
      {/* Glyph hidden by default, revealed on group hover via a parent CSS rule
          if a theme wants it. For phase 1, traffic lights stay glyph-less to
          keep the look honest. */}
    </button>
  );
}
