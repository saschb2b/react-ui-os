"use client";

import {
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
  recordSnapRestore,
  peekSnapRestore,
  clearSnapRestore,
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
import { useReducedMotion } from "./util/use-reduced-motion";

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
  /** Pointer's fraction along the title-bar width at grab time (0..1). */
  grabFracX: number;
  /** Pointer's pixel offset below the title-bar top at grab time. */
  grabOffsetY: number;
  /**
   * The window was maximized when this drag began. It stays maximized until the
   * pointer crosses the tear-off threshold, at which point it restores under
   * the cursor and the drag continues from there. Until then a bare click or a
   * double-click is left to their own handlers.
   */
  fromMaximized?: boolean;
  /**
   * The window was snapped to a zone when this drag began; this is the size it
   * had before snapping. Like {@link fromMaximized}, crossing the tear-off
   * threshold restores it to this size under the cursor.
   */
  snapRestore?: { w: number; h: number };
}

// Pointer travel before a drag on a maximized or snapped title bar tears the
// window off and restores it. Keeps a click or double-click from restoring by
// accident.
const TEAR_OFF_PX = 6;

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

  // Honor reduced motion: open / close / minimize and the maximize/snap glide
  // collapse to instant. Each animation string and its matching dispatch
  // timeout read the same derived duration, so they stay in step (a 0 ms
  // animation still fires animationend, and a 0 ms timeout dispatches on the
  // next tick).
  const reducedMotion = useReducedMotion();
  const { windowOpenDurationMs, genieDurationMs } = theme.motion;
  const openMs = reducedMotion ? 0 : windowOpenDurationMs;
  const genieMs = reducedMotion ? 0 : genieDurationMs;

  // After the open animation finishes, drop the phase so subsequent re-renders
  // don't replay it. Tied to the theme's window-open duration.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPhase("idle");
    }, openMs + 40);
    return () => {
      window.clearTimeout(id);
    };
  }, [openMs]);

  // Forget this window's pre-snap size when it closes. Ids are reused
  // (`app:notes` survives close + reopen), so a stale record would make a
  // reopened window restore to the wrong size on its first drag.
  useEffect(() => {
    return () => {
      clearSnapRestore(win.id);
    };
  }, [win.id]);

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
    }, genieMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [win.state, appPayload, genieMs]);

  // Stagger this window in the cascade by how many windows on its workspace
  // opened before it (every existing window sits below the just-opened one in
  // z, so this counts them). Only computed while the window still needs auto
  // placement; once placed, the ternary skips the scan.
  const cascadeIndex = win.autoBounds
    ? wm.state.windows.filter(
        (w) => w.id !== win.id && w.workspaceId === win.workspaceId && w.z < win.z,
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

  // These handlers were hand-wrapped in useCallback for stable identity when
  // passed to the title bar and resize grips. The React Compiler memoizes
  // them now, so they are plain functions.
  const handleClose = () => {
    setPhase("closing");
    const t = window.setTimeout(() => {
      closeWindow(win.id);
    }, openMs);
    return () => {
      window.clearTimeout(t);
    };
  };

  const handleMinimize = () => {
    if (elRef.current) setGenieVars(elRef.current, appPayload);
    setPhase("minimizing");
    const t = window.setTimeout(() => {
      minimizeWindow(win.id);
      setPhase("idle");
    }, genieMs);
    return () => {
      window.clearTimeout(t);
    };
  };

  const handleMaximize = () => {
    const willMaximize = win.state !== "maximized";
    toggleMaximize(win.id);
    showHud({ title: willMaximize ? "Maximized" : "Restored" });
  };

  const handleTitleContextMenu = (e: React.MouseEvent) => {
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
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const fromMaximized = win.state === "maximized";
    const snapRestore = fromMaximized ? undefined : peekSnapRestore(win.id);
    // Anchor the pointer on the title bar so a tear-off can keep it there.
    const bar = e.currentTarget.getBoundingClientRect();
    const grabFracX = bar.width > 0 ? (e.clientX - bar.left) / bar.width : 0.5;
    const grabOffsetY = e.clientY - bar.top;
    focusWindow(win.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    // A maximized or snapped window stays put (and keeps its transition) until
    // the pointer tears it off in moveDrag; a plain drag starts gesturing now.
    if (!fromMaximized && !snapRestore) setGesturing(true);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: win.x,
      startY: win.y,
      lastX: win.x,
      lastY: win.y,
      grabFracX,
      grabOffsetY,
      fromMaximized,
      snapRestore,
    };
  };

  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const work = getWorkArea(theme);
    if (drag.fromMaximized || drag.snapRestore) {
      // Wait for real travel so a click or double-click on a maximized or
      // snapped title bar is not mistaken for a tear-off.
      if (
        Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) <
        TEAR_OFF_PX
      ) {
        return;
      }
      // Restore the window under the cursor (Windows 11): a maximized window
      // returns to its normal size, a snapped one to its pre-snap size, with
      // the pointer kept at the same fraction along, and the same offset down,
      // the now-narrower title bar, so it lands right under the cursor.
      const restoreW = drag.snapRestore ? drag.snapRestore.w : win.w;
      const restoreH = drag.snapRestore ? drag.snapRestore.h : win.h;
      const restoredX = Math.max(
        work.x,
        Math.min(e.clientX - restoreW * drag.grabFracX, work.x + work.width - restoreW),
      );
      const restoredY = Math.max(work.y, e.clientY - drag.grabOffsetY);
      if (drag.fromMaximized) toggleMaximize(win.id);
      setBounds(win.id, restoredX, restoredY, restoreW, restoreH);
      setGesturing(true);
      clearSnapRestore(win.id);
      drag.fromMaximized = false;
      drag.snapRestore = undefined;
      drag.startX = restoredX;
      drag.startY = restoredY;
      drag.startClientX = e.clientX;
      drag.startClientY = e.clientY;
      drag.lastX = restoredX;
      drag.lastY = restoredY;
      const elNow = elRef.current;
      if (elNow) {
        elNow.style.transform = `translate3d(${String(restoredX)}px, ${String(restoredY)}px, 0)`;
        elNow.style.width = `${String(restoreW)}px`;
        elNow.style.height = `${String(restoreH)}px`;
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
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.fromMaximized || drag.snapRestore) {
      // Released without ever tearing off: a click (or the first half of a
      // double-click) on a maximized or snapped title bar. Leave the window
      // as it is; double-click still restores a maximized one via its own
      // handler, and a snapped one stays snapped.
      dragRef.current = null;
      return;
    }
    // The gesture is over, so the transition comes back on: a snap glides
    // into its zone, while a plain release commits to the spot the window
    // already sits at (same value, so nothing animates).
    setGesturing(false);
    const snap = getSnapPreview();
    if (snap && snap.windowId === win.id) {
      // Remember the size to come back to when this snap is later dragged
      // off (recordSnapRestore keeps the first size, so re-snapping does not
      // overwrite it).
      recordSnapRestore(win.id, { w: win.w, h: win.h });
      setBounds(win.id, snap.rect.x, snap.rect.y, snap.rect.w, snap.rect.h);
      showHud({ title: snapZoneLabel(snap.zone) });
    } else {
      setBounds(win.id, drag.lastX, drag.lastY, win.w, win.h);
    }
    setSnapPreview(null);
    dragRef.current = null;
  };

  const startResize = (dir: ResizeDir, e: ReactPointerEvent<HTMLDivElement>) => {
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
  };

  const moveResize = (e: ReactPointerEvent<HTMLDivElement>) => {
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
  };

  const endResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    setGesturing(false);
    // A hand-picked size cancels the snap memory: dragging away now keeps it.
    clearSnapRestore(win.id);
    setBounds(win.id, r.lastX, r.lastY, r.lastW, r.lastH);
    resizeRef.current = null;
  };

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
          animation: `rui-window-open ${String(openMs)}ms ${theme.motion.windowOpenEasing} both`,
        }
      : phase === "closing"
        ? {
            animation: `rui-window-close ${String(openMs)}ms ${theme.motion.windowOpenEasing} both`,
          }
        : phase === "minimizing"
          ? {
              animation: `rui-window-genie ${String(genieMs)}ms ${theme.motion.genieEasing} both`,
            }
          : phase === "restoring"
            ? {
                animation: `rui-window-genie ${String(genieMs)}ms ${theme.motion.genieEasing} reverse both`,
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
            : `transform ${String(openMs)}ms ${theme.motion.windowOpenEasing}, width ${String(openMs)}ms ${theme.motion.windowOpenEasing}, height ${String(openMs)}ms ${theme.motion.windowOpenEasing}`,
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
          ) : controls === "gnome" ? (
            <GnomeControls
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
  const idleColor = focused ? theme.palette.textPrimary : theme.palette.textSecondary;
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
 * GNOME / Adwaita caption cluster: minimize, maximize/restore, close as three
 * round symbolic buttons on the right. Each is a circle with a faint tint of
 * the text color that lifts on hover, the neutral Adwaita treatment (Yaru does
 * not redden the close button), with a symbolic glyph centered inside.
 * Sources: libadwaita window-controls (24px circular buttons, neutral hover);
 * GNOME default button-layout ":minimize,maximize,close".
 */
function GnomeControls({
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
        e.stopPropagation();
      }}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <GnomeControl
        glyph="minimize"
        focused={focused}
        onClick={onMinimize}
        ariaLabel="Minimize"
      />
      <GnomeControl
        glyph={maximized ? "restore" : "maximize"}
        focused={focused}
        onClick={onMaximize}
        ariaLabel={maximized ? "Restore" : "Maximize"}
      />
      <GnomeControl
        glyph="close"
        focused={focused}
        onClick={onClose}
        ariaLabel="Close"
      />
    </div>
  );
}

function GnomeControl({
  glyph,
  focused,
  onClick,
  ariaLabel,
}: {
  glyph: CaptionGlyphKind;
  focused: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const theme = useTheme();
  const idle = `${theme.palette.textPrimary}1a`;
  const hover = `${theme.palette.textPrimary}2e`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        appearance: "none",
        border: 0,
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        background: idle,
        color: focused ? theme.palette.textPrimary : theme.palette.textSecondary,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = idle;
      }}
    >
      <CaptionGlyph glyph={glyph} size={glyph === "minimize" ? 11 : 10} />
    </button>
  );
}

/**
 * Minimal chrome: a single close affordance, top-right. The neutral / minimal
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

function CaptionGlyph({
  glyph,
  size = 10,
}: {
  glyph: CaptionGlyphKind;
  size?: number;
}) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1,
  } as const;
  switch (glyph) {
    case "minimize":
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden {...stroke}>
          <line x1="0" y1="5" x2="10" y2="5" />
        </svg>
      );
    case "maximize":
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden {...stroke}>
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      );
    case "restore":
      // Two overlapping squares: the front one full, the back one showing only
      // its top and right edges, as Windows draws the restore glyph.
      return (
        <svg width={size} height={size} viewBox="0 0 11 11" aria-hidden {...stroke}>
          <rect x="0.5" y="3.5" width="7" height="7" />
          <path d="M3.5 3.5 V0.5 H10.5 V7.5 H7.5" />
        </svg>
      );
    case "close":
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden {...stroke}>
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
  // macOS reveals the close/minimize/zoom glyphs only while the cursor is over
  // the group, and only then. Track the group hover and pass it to each light.
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onPointerDown={(e) => {
        // Don't let traffic-light clicks bubble up to start a window drag.
        e.stopPropagation();
      }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      // 8 px between centers matches the macOS title-bar spacing.
      style={{ display: "flex", gap: 8 }}
    >
      <TrafficLight
        kind="close"
        color="#ff5f57"
        onClick={onClose}
        focused={focused}
        revealed={hovered}
      />
      <TrafficLight
        kind="minimize"
        color="#febc2e"
        onClick={onMinimize}
        focused={focused}
        revealed={hovered}
      />
      <TrafficLight
        kind="zoom"
        color="#28c840"
        onClick={onMaximize}
        focused={focused}
        revealed={hovered}
      />
    </div>
  );
}

function TrafficLightGlyph({ kind }: { kind: "close" | "minimize" | "zoom" }) {
  const stroke = "rgba(0,0,0,0.55)";
  if (kind === "close") {
    return (
      <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden>
        <path
          d="M1.4 1.4 L5.6 5.6 M5.6 1.4 L1.4 5.6"
          stroke={stroke}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "minimize") {
    return (
      <svg width="8" height="7" viewBox="0 0 8 7" aria-hidden>
        <path
          d="M1.2 3.5 H6.8"
          stroke={stroke}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // Zoom: the two opposed triangles macOS shows for the green button.
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden fill="rgba(0,0,0,0.55)">
      <path d="M1.2 1.2 H5 L1.2 5 Z" />
      <path d="M6.8 6.8 H3 L6.8 3 Z" />
    </svg>
  );
}

function TrafficLight({
  kind,
  color,
  onClick,
  focused,
  revealed,
}: {
  kind: "close" | "minimize" | "zoom";
  color: string;
  onClick: () => void;
  focused: boolean;
  revealed: boolean;
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
        // Unfocused windows wash the lights to a single pale gray, the macOS
        // inactive treatment (a dark fill reads as a bug on a light window).
        background: focused ? color : "rgba(0,0,0,0.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 1,
        boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.18)",
      }}
      aria-label={
        kind === "close" ? "Close" : kind === "minimize" ? "Minimize" : "Maximize"
      }
    >
      {/* Glyphs reveal only on group hover, and only on focused (colored)
          lights, the macOS behavior. */}
      <span
        aria-hidden
        style={{
          display: "flex",
          opacity: revealed && focused ? 1 : 0,
          transition: "opacity 120ms ease",
        }}
      >
        <TrafficLightGlyph kind={kind} />
      </span>
    </button>
  );
}
