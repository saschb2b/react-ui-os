"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWindowManager } from "@react-ui-os/core";
import type { OpenWindow } from "@react-ui-os/core";
import { useApp, useApps, useTheme } from "./desktop-context";
import { getDockTileRect } from "./Dock";
import { clampWindowToWorkArea } from "./util/clamp";
import { pickInitialBounds } from "./util/initial-bounds";
import { openContextMenu, type ContextMenuItem } from "./context-menu";
import {
  computeSnapZone,
  rectForZone,
  setSnapPreview,
  getSnapPreview,
  type SnapZone,
} from "./snap";
import { showHud } from "./hud";

function snapZoneLabel(zone: SnapZone): string {
  switch (zone) {
    case "left-half":
      return "Snapped Left";
    case "right-half":
      return "Snapped Right";
    case "top-max":
      return "Maximized";
    case "top-left-quarter":
      return "Top Left Quarter";
    case "top-right-quarter":
      return "Top Right Quarter";
    case "bottom-left-quarter":
      return "Bottom Left Quarter";
    case "bottom-right-quarter":
      return "Bottom Right Quarter";
  }
}
import { getSystemWindow, resolveSystemWindowName } from "./system-windows";
import { getChromeMetrics, getWorkArea } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

interface WindowProps {
  win: OpenWindow;
  /**
   * True when the window lives on a workspace other than the active one. The
   * window stays mounted (its state survives) but renders with `display: none`
   * so it is out of layout and not interactable until its workspace is active.
   */
  hidden?: boolean;
}

type AnimationPhase = "idle" | "opening" | "closing" | "minimizing" | "restoring";

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_W = 240;
const MIN_H = 160;

// Neutral default elevation, used when a theme does not declare `elevation`.
// Black at low alpha, deeper when focused: shadow conveys lift, never tint.
const DEFAULT_WINDOW_SHADOW_FOCUSED =
  "0 20px 50px -12px rgba(0,0,0,0.55), 0 8px 18px -6px rgba(0,0,0,0.35)";
const DEFAULT_WINDOW_SHADOW_UNFOCUSED = "0 10px 24px -8px rgba(0,0,0,0.4)";

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /**
   * The window was maximized when this drag began. It stays maximized until the
   * pointer crosses the tear-off threshold, at which point it restores under
   * the cursor and the drag continues from there. Until then a bare click or a
   * double-click is left to their own handlers.
   */
  fromMaximized?: boolean;
}

// Pointer travel before a drag on a maximized title bar tears the window off
// and restores it. Keeps a click or double-click from restoring by accident.
const MAXIMIZED_TEAR_OFF_PX = 6;

interface ResizeState {
  pointerId: number;
  dir: ResizeDir;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  lastX: number;
  lastY: number;
  lastW: number;
  lastH: number;
}

/**
 * Set the four custom properties the genie keyframe reads: `from` is the
 * window's current top-left, `to` is the translate that lands the window's
 * center on its dock tile once the scale shrinks it. Minimize plays the
 * keyframe forward (window to tile); restore plays it reversed (tile to
 * window). Without a dock tile the window collapses in place.
 */
function setGenieVars(el: HTMLDivElement, appId: string | undefined): void {
  const winRect = el.getBoundingClientRect();
  const dockRect = appId ? getDockTileRect(appId) : null;
  const toCenterX = dockRect
    ? dockRect.left + dockRect.width / 2
    : winRect.left + winRect.width / 2;
  const toCenterY = dockRect
    ? dockRect.top + dockRect.height / 2
    : winRect.top + winRect.height / 2;
  el.style.setProperty("--genie-from-x", `${String(winRect.left)}px`);
  el.style.setProperty("--genie-from-y", `${String(winRect.top)}px`);
  el.style.setProperty("--genie-to-x", `${String(toCenterX - winRect.width / 2)}px`);
  el.style.setProperty("--genie-to-y", `${String(toCenterY - winRect.height / 2)}px`);
}

/**
 * One window. Renders the chrome (title bar with traffic lights) plus the
 * app content. Drag writes the transform directly to the DOM during the
 * gesture and only commits to React state on pointerup, so dragging four
 * windows with live content stays at 60 fps.
 */
export function Window({ win, hidden = false }: WindowProps) {
  const theme = useTheme();
  const apps = useApps();
  const wm = useWindowManager();
  const {
    focusedWindow,
    focusWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    setBounds,
  } = wm;
  const focused = focusedWindow?.id === win.id;
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const titleBarHeight = metrics.titleBarHeight;

  const appPayload = win.payload.kind === "app" ? win.payload.appId : undefined;
  const app = useApp(appPayload ?? "__none__");
  const systemDef =
    win.payload.kind === "system" ? getSystemWindow(win.payload.systemId) : undefined;
  const systemArgs = win.payload.kind === "system" ? win.payload.args : undefined;

  const title =
    win.payload.kind === "app"
      ? (app?.name ?? "Window")
      : systemDef
        ? resolveSystemWindowName(systemDef, systemArgs)
        : "Window";
  const accent =
    win.payload.kind === "app"
      ? (app?.accent ?? theme.palette.accent)
      : (systemDef?.accent ?? theme.palette.accent);

  const elRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>("opening");
  // True only while a pointer drag or resize is in flight. Those write the
  // transform (and size) to the DOM every frame, so the CSS geometry
  // transition has to be off then. The rest of the time it stays on, which
  // glides programmatic geometry changes (maximize, restore from maximize, and
  // snapping into a zone) the way macOS zoom and Windows Snap do.
  const [gesturing, setGesturing] = useState(false);
  const prevStateRef = useRef(win.state);

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

  // Un-minimize plays the genie in reverse: the window grows out of its dock
  // tile back to where it sat. Detected here (not at the restore call site)
  // because restore can come from the dock, Spotlight, the app switcher, or a
  // shortcut. Runs before paint so the first frame is already at the tile,
  // never a flash of the full-size window.
  useLayoutEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = win.state;
    if (prev !== "minimized" || win.state !== "normal") return;
    if (elRef.current) setGenieVars(elRef.current, appPayload);
    setPhase("restoring");
    const id = window.setTimeout(() => {
      setPhase("idle");
    }, theme.motion.genieDurationMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [win.state, appPayload, theme.motion.genieDurationMs]);

  // Stagger this window in the cascade by how many windows on its workspace
  // opened before it (every existing window sits below the just-opened one in
  // z, so this counts them). Only computed while the window still needs auto
  // placement; once placed, the ternary skips the scan.
  const cascadeIndex = win.autoBounds
    ? wm.state.windows.filter(
        (w) =>
          w.id !== win.id && w.workspaceId === win.workspaceId && w.z < win.z,
      ).length
    : 0;

  // Place a window that was opened without explicit bounds. core flags these
  // (autoBounds) because it can't see the viewport; we resolve them here to
  // the same centered, work-area-clamped bounds every surface uses, so a bare
  // openWindow(payload) can never spawn an off-screen or oversized window.
  // useLayoutEffect runs before paint, so the first painted frame is already
  // at the correct size: no flash. setBounds clears the flag, so a later
  // remount (workspace switch) won't re-place a window the user has moved.
  useLayoutEffect(() => {
    if (!win.autoBounds) return;
    const b = pickInitialBounds(win.payload, theme, apps, undefined, cascadeIndex);
    setBounds(win.id, b.x, b.y, b.w, b.h);
  }, [win.autoBounds, win.id, win.payload, theme, apps, setBounds, cascadeIndex]);

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
    if (elRef.current) setGenieVars(elRef.current, appPayload);
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
    const willMaximize = win.state !== "maximized";
    toggleMaximize(win.id);
    showHud({ title: willMaximize ? "Maximized" : "Restored" });
  }, [toggleMaximize, win.id, win.state]);

  const handleTitleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const isMaximized = win.state === "maximized";
      const wmState = wm.state;
      const workspaces = wmState.workspaces;
      const items: ContextMenuItem[] = [
        {
          label: isMaximized ? "Restore" : "Maximize",
          shortcut: isMaximized ? "Esc" : "⌘↩",
          onSelect: handleMaximize,
        },
        {
          label: "Minimize",
          shortcut: "⌘M",
          onSelect: () => {
            handleMinimize();
          },
        },
      ];
      if (workspaces.length > 1) {
        items.push({ separator: true });
        for (let i = 0; i < workspaces.length; i++) {
          const wsId = workspaces[i];
          if (!wsId) continue;
          items.push({
            label: `Move to Workspace ${String(i + 1)}`,
            disabled: wsId === win.workspaceId,
            onSelect: () => {
              wm.moveWindowToWorkspace(win.id, wsId);
            },
          });
        }
      }
      items.push({ separator: true });
      items.push({
        label: "Close",
        shortcut: "⌘W",
        danger: true,
        onSelect: () => {
          handleClose();
        },
      });
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        items,
        ariaLabel: `${title} window menu`,
      });
    },
    [
      handleClose,
      handleMaximize,
      handleMinimize,
      win.state,
      win.id,
      win.workspaceId,
      title,
      wm,
    ],
  );

  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const fromMaximized = win.state === "maximized";
      focusWindow(win.id);
      e.currentTarget.setPointerCapture(e.pointerId);
      // A maximized window stays put (and keeps its transition) until the
      // pointer tears it off in moveDrag; a normal drag starts gesturing now.
      if (!fromMaximized) setGesturing(true);
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: win.x,
        startY: win.y,
        lastX: win.x,
        lastY: win.y,
        fromMaximized,
      };
    },
    [focusWindow, win.id, win.state, win.x, win.y],
  );

  const moveDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const work = getWorkArea(theme);
      if (drag.fromMaximized) {
        // Wait for real travel so a click or double-click on the maximized
        // title bar is not mistaken for a tear-off.
        if (
          Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) <
          MAXIMIZED_TEAR_OFF_PX
        ) {
          return;
        }
        // Restore the window under the cursor (Windows 11): keep the pointer at
        // the same horizontal fraction of the now-narrower title bar, and at
        // the same vertical offset within it as the original grab, so the
        // title bar lands right under the cursor rather than jumping away.
        const fracX = work.width > 0 ? (e.clientX - work.x) / work.width : 0.5;
        const restoredX = Math.max(
          work.x,
          Math.min(e.clientX - win.w * fracX, work.x + work.width - win.w),
        );
        const grabOffsetY = drag.startClientY - work.y;
        const restoredY = Math.max(work.y, e.clientY - grabOffsetY);
        toggleMaximize(win.id);
        setBounds(win.id, restoredX, restoredY, win.w, win.h);
        setGesturing(true);
        drag.fromMaximized = false;
        drag.startX = restoredX;
        drag.startY = restoredY;
        drag.startClientX = e.clientX;
        drag.startClientY = e.clientY;
        drag.lastX = restoredX;
        drag.lastY = restoredY;
        const elNow = elRef.current;
        if (elNow) {
          elNow.style.transform = `translate3d(${String(restoredX)}px, ${String(restoredY)}px, 0)`;
          elNow.style.width = `${String(win.w)}px`;
          elNow.style.height = `${String(win.h)}px`;
        }
        return;
      }
      const targetX = drag.startX + (e.clientX - drag.startClientX);
      const targetY = drag.startY + (e.clientY - drag.startClientY);
      const clamped = clampWindowToWorkArea(targetX, targetY, win.w, win.h, work);
      drag.lastX = clamped.x;
      drag.lastY = clamped.y;
      const el = elRef.current;
      if (el) {
        el.style.transform = `translate3d(${String(clamped.x)}px, ${String(clamped.y)}px, 0)`;
      }
      // Snap preview tracks the pointer, not the window. Drag the pointer
      // into the edge zone; the preview lights up; on release we snap.
      const zone = computeSnapZone(e.clientX, e.clientY, work);
      if (zone) {
        setSnapPreview({
          windowId: win.id,
          zone,
          rect: rectForZone(zone, work),
        });
      } else {
        setSnapPreview(null);
      }
    },
    [theme, win.id, win.w, win.h, toggleMaximize, setBounds],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (drag.fromMaximized) {
        // Released without ever tearing off: a click (or the first half of a
        // double-click) on a maximized title bar. Leave the window maximized
        // and untouched; double-click restores it through its own handler.
        dragRef.current = null;
        return;
      }
      // The gesture is over, so the transition comes back on: a snap glides
      // into its zone, while a plain release commits to the spot the window
      // already sits at (same value, so nothing animates).
      setGesturing(false);
      const snap = getSnapPreview();
      if (snap && snap.windowId === win.id) {
        setBounds(win.id, snap.rect.x, snap.rect.y, snap.rect.w, snap.rect.h);
        showHud({ title: snapZoneLabel(snap.zone) });
      } else {
        setBounds(win.id, drag.lastX, drag.lastY, win.w, win.h);
      }
      setSnapPreview(null);
      dragRef.current = null;
    },
    [setBounds, win.id, win.w, win.h],
  );

  const startResize = useCallback(
    (dir: ResizeDir, e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (win.state === "maximized") return;
      e.stopPropagation();
      setGesturing(true);
      focusWindow(win.id);
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        pointerId: e.pointerId,
        dir,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: win.x,
        startY: win.y,
        startW: win.w,
        startH: win.h,
        lastX: win.x,
        lastY: win.y,
        lastW: win.w,
        lastH: win.h,
      };
    },
    [focusWindow, win.id, win.state, win.x, win.y, win.w, win.h],
  );

  const moveResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    const dx = e.clientX - r.startClientX;
    const dy = e.clientY - r.startClientY;
    let x = r.startX;
    let y = r.startY;
    let w = r.startW;
    let h = r.startH;
    if (r.dir.includes("e")) w = Math.max(MIN_W, r.startW + dx);
    if (r.dir.includes("w")) {
      const nextW = Math.max(MIN_W, r.startW - dx);
      x = r.startX + (r.startW - nextW);
      w = nextW;
    }
    if (r.dir.includes("s")) h = Math.max(MIN_H, r.startH + dy);
    if (r.dir.includes("n")) {
      const nextH = Math.max(MIN_H, r.startH - dy);
      y = r.startY + (r.startH - nextH);
      h = nextH;
    }
    r.lastX = x;
    r.lastY = y;
    r.lastW = w;
    r.lastH = h;
    const el = elRef.current;
    if (el) {
      el.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0)`;
      el.style.width = `${String(w)}px`;
      el.style.height = `${String(h)}px`;
    }
  }, []);

  const endResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const r = resizeRef.current;
      if (!r || r.pointerId !== e.pointerId) return;
      setGesturing(false);
      setBounds(win.id, r.lastX, r.lastY, r.lastW, r.lastH);
      resizeRef.current = null;
    },
    [setBounds, win.id],
  );

  const maximized = win.state === "maximized";
  const work = getWorkArea(theme);

  // Window bounds are viewport-absolute (win.x / win.y are screen pixels), so
  // the element anchors at the viewport origin (top/left 0) and the transform
  // carries the full position. Maximized fills the work area, which starts
  // below the menu bar at (work.x, work.y). pickInitialBounds, snap rects, and
  // the SnapPreview overlay all speak these same absolute coords.
  const baseTransform = maximized
    ? `translate3d(${String(work.x)}px, ${String(work.y)}px, 0)`
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
          : phase === "restoring"
            ? {
                animation: `rui-window-genie ${String(theme.motion.genieDurationMs)}ms ${theme.motion.genieEasing} reverse both`,
              }
            : {};

  if (win.state === "minimized" && phase !== "minimizing") return null;

  return (
    <div
      ref={elRef}
      role="region"
      aria-label={`${title} window`}
      data-rui-window={win.id}
      onPointerDown={() => {
        if (!focused) focusWindow(win.id);
      }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: maximized ? work.width : win.w,
        height: maximized ? work.height : win.h,
        transform: baseTransform,
        // Glide programmatic geometry changes (maximize, restore, snap). Off
        // while a drag or resize writes the transform per frame, and during the
        // open / close / genie phases, which run their own keyframes.
        transition:
          gesturing || phase !== "idle"
            ? undefined
            : `transform ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}, width ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}, height ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}`,
        backgroundColor: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        border: `1px solid ${theme.palette.border}`,
        borderRadius: maximized ? 0 : theme.shape.windowRadius,
        boxShadow: focused
          ? (theme.elevation?.windowFocused ?? DEFAULT_WINDOW_SHADOW_FOCUSED)
          : (theme.elevation?.windowUnfocused ?? DEFAULT_WINDOW_SHADOW_UNFOCUSED),
        color: theme.palette.textPrimary,
        overflow: "hidden",
        // Off-workspace windows stay mounted but drop out of layout entirely.
        display: hidden ? "none" : "flex",
        flexDirection: "column",
        zIndex: 100 + win.z,
        ...animationStyle,
      }}
    >
      <TitleBar
        title={title}
        focused={focused}
        accent={accent}
        height={titleBarHeight}
        maximized={maximized}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleMaximize}
        onContextMenu={handleTitleContextMenu}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: 16,
        }}
      >
        {app ? (
          <app.content appId={app.id} focused={focused} />
        ) : systemDef ? (
          <systemDef.content focused={focused} args={systemArgs} />
        ) : null}
      </div>
      {!maximized && (
        <ResizeHandles onStart={startResize} onMove={moveResize} onEnd={endResize} />
      )}
    </div>
  );
}

interface ResizeHandlesProps {
  onStart: (dir: ResizeDir, e: ReactPointerEvent<HTMLDivElement>) => void;
  onMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

const HANDLE_THICKNESS = 6;
const CORNER_SIZE = 12;

/**
 * Eight invisible drag grips around the window's edges and corners. Each
 * gets its own resize cursor; the parent <Window> owns the actual resize
 * state machine so handles only need to forward pointer events.
 */
function ResizeHandles({ onStart, onMove, onEnd }: ResizeHandlesProps) {
  const edge = (dir: ResizeDir, style: React.CSSProperties, cursor: string) => (
    <div
      key={dir}
      onPointerDown={(e) => {
        onStart(dir, e);
      }}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      style={{
        position: "absolute",
        cursor,
        touchAction: "none",
        ...style,
      }}
    />
  );

  return (
    <>
      {edge(
        "n",
        {
          top: 0,
          left: CORNER_SIZE,
          right: CORNER_SIZE,
          height: HANDLE_THICKNESS,
        },
        "ns-resize",
      )}
      {edge(
        "s",
        {
          bottom: 0,
          left: CORNER_SIZE,
          right: CORNER_SIZE,
          height: HANDLE_THICKNESS,
        },
        "ns-resize",
      )}
      {edge(
        "e",
        {
          right: 0,
          top: CORNER_SIZE,
          bottom: CORNER_SIZE,
          width: HANDLE_THICKNESS,
        },
        "ew-resize",
      )}
      {edge(
        "w",
        {
          left: 0,
          top: CORNER_SIZE,
          bottom: CORNER_SIZE,
          width: HANDLE_THICKNESS,
        },
        "ew-resize",
      )}
      {edge(
        "nw",
        { top: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE },
        "nwse-resize",
      )}
      {edge(
        "ne",
        { top: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE },
        "nesw-resize",
      )}
      {edge(
        "sw",
        { bottom: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE },
        "nesw-resize",
      )}
      {edge(
        "se",
        { bottom: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE },
        "nwse-resize",
      )}
    </>
  );
}

interface TitleBarProps {
  title: string;
  focused: boolean;
  accent: string;
  height: number;
  maximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function TitleBar({
  title,
  focused,
  accent,
  height,
  maximized,
  onClose,
  onMinimize,
  onMaximize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onContextMenu,
}: TitleBarProps) {
  const theme = useTheme();
  const controls = theme.chrome.windowControls;
  const trafficLights = controls === "traffic-lights";
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        position: "relative",
        height: height,
        display: "flex",
        alignItems: "center",
        justifyContent: trafficLights ? "space-between" : undefined,
        // Windows 11 draws its caption buttons flush into the top-right corner
        // with no inset; macOS and minimal chrome keep a gutter on both sides.
        paddingLeft: trafficLights ? 10 : 12,
        paddingRight: controls === "windows" ? 0 : 10,
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
      {trafficLights ? (
        <>
          <TrafficLights
            focused={focused}
            onClose={onClose}
            onMinimize={onMinimize}
            onMaximize={onMaximize}
          />
          <TitleLabel title={title} focused={focused} centered />
          <span style={{ width: 60 }} aria-hidden />
        </>
      ) : (
        <>
          <TitleLabel title={title} focused={focused} />
          {controls === "windows" ? (
            <WindowsControls
              focused={focused}
              maximized={maximized}
              onClose={onClose}
              onMinimize={onMinimize}
              onMaximize={onMaximize}
            />
          ) : (
            <MinimalControls focused={focused} onClose={onClose} />
          )}
        </>
      )}
    </div>
  );
}

function TitleLabel({
  title,
  focused,
  centered = false,
}: {
  title: string;
  focused: boolean;
  centered?: boolean;
}) {
  const theme = useTheme();
  return (
    <span
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: 12,
        // macOS centers a medium-weight title; Windows and minimal chrome
        // left-align a regular-weight one and let it truncate.
        fontWeight: centered ? 500 : 400,
        color: focused ? theme.palette.textPrimary : theme.palette.textSecondary,
        ...(centered
          ? {}
          : {
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: 8,
            }),
      }}
    >
      {title}
    </span>
  );
}

/**
 * Windows 11 caption cluster: minimize, maximize/restore, close, flush in the
 * top-right corner. Each button is 46px wide (the Windows shell metric) and
 * fills the title-bar height; the close button turns red (#c42b1c) on hover.
 * Glyphs are drawn as 1px-stroke SVGs so they don't depend on the Segoe Fluent
 * Icons font being installed.
 */
function WindowsControls({
  focused,
  maximized,
  onClose,
  onMinimize,
  onMaximize,
}: {
  focused: boolean;
  maximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => {
        // Keep caption clicks from starting a window drag.
        e.stopPropagation();
      }}
      style={{ display: "flex", alignSelf: "stretch" }}
    >
      <CaptionButton
        glyph="minimize"
        focused={focused}
        onClick={onMinimize}
        ariaLabel="Minimize"
      />
      <CaptionButton
        glyph={maximized ? "restore" : "maximize"}
        focused={focused}
        onClick={onMaximize}
        ariaLabel={maximized ? "Restore" : "Maximize"}
      />
      <CaptionButton
        glyph="close"
        focused={focused}
        onClick={onClose}
        ariaLabel="Close"
        danger
      />
    </div>
  );
}

function CaptionButton({
  glyph,
  focused,
  onClick,
  ariaLabel,
  danger = false,
}: {
  glyph: CaptionGlyphKind;
  focused: boolean;
  onClick: () => void;
  ariaLabel: string;
  danger?: boolean;
}) {
  const theme = useTheme();
  // Neutral hover tint (a translucent slice of the text color) reads on light
  // and dark surfaces alike; the close button overrides it with red.
  const hover = `${theme.palette.textPrimary}1a`;
  const idleColor = focused
    ? theme.palette.textPrimary
    : theme.palette.textSecondary;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        appearance: "none",
        border: 0,
        background: "transparent",
        width: 46,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        color: idleColor,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#c42b1c" : hover;
        if (danger) e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        if (danger) e.currentTarget.style.color = idleColor;
      }}
    >
      <CaptionGlyph glyph={glyph} />
    </button>
  );
}

/**
 * Minimal chrome: a single close affordance, top-right. The neutral / SaaS
 * register that wants window dismissal without a full traffic-light or caption
 * cluster (DESIGN.md spectrum point 2).
 */
function MinimalControls({
  focused,
  onClose,
}: {
  focused: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}1a`;
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={onClose}
      aria-label="Close"
      style={{
        appearance: "none",
        border: 0,
        background: "transparent",
        width: 24,
        height: 24,
        borderRadius: theme.shape.small,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        color: focused ? theme.palette.textPrimary : theme.palette.textSecondary,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <CaptionGlyph glyph="close" />
    </button>
  );
}

type CaptionGlyphKind = "minimize" | "maximize" | "restore" | "close";

function CaptionGlyph({ glyph }: { glyph: CaptionGlyphKind }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1,
  } as const;
  switch (glyph) {
    case "minimize":
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden {...stroke}>
          <line x1="0" y1="5" x2="10" y2="5" />
        </svg>
      );
    case "maximize":
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden {...stroke}>
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      );
    case "restore":
      // Two overlapping squares: the front one full, the back one showing only
      // its top and right edges, as Windows draws the restore glyph.
      return (
        <svg width={11} height={11} viewBox="0 0 11 11" aria-hidden {...stroke}>
          <rect x="0.5" y="3.5" width="7" height="7" />
          <path d="M3.5 3.5 V0.5 H10.5 V7.5 H7.5" />
        </svg>
      );
    case "close":
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden {...stroke}>
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
        </svg>
      );
  }
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
      <TrafficLight
        color="#ff5f57"
        hoverGlyph="x"
        onClick={onClose}
        focused={focused}
      />
      <TrafficLight
        color="#febc2e"
        hoverGlyph="-"
        onClick={onMinimize}
        focused={focused}
      />
      <TrafficLight
        color="#28c840"
        hoverGlyph="+"
        onClick={onMaximize}
        focused={focused}
      />
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
      aria-label={
        hoverGlyph === "x" ? "Close" : hoverGlyph === "-" ? "Minimize" : "Maximize"
      }
    >
      {/* Glyph hidden by default, revealed on group hover via a parent CSS rule
          if a theme wants it. For phase 1, traffic lights stay glyph-less to
          keep the look honest. */}
    </button>
  );
}
