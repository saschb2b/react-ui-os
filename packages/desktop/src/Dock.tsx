"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  markAllNotificationsRead,
  useNotifications,
  useWindowManager,
  windowIdOf,
} from "@react-ui-os/core";
import type { App, OsTheme } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { openContextMenu, type ContextMenuItem } from "./context-menu";
import {
  MISSION_CONTROL_TOGGLE_EVENT,
  NOTIFICATION_CENTER_TOGGLE_EVENT,
  SPOTLIGHT_OPEN_EVENT,
} from "./events";
import { listStatusItems, subscribeStatusItems, type StatusItem } from "./status-items";
import { requestSettingsSection } from "./settings-nav";
import { nextCascadeIndex, pickInitialBounds } from "./util/initial-bounds";
import {
  getBarThickness,
  getChromeMetrics,
  getDockTileSize,
  getMenuBarHeight,
} from "./util/layout";
import { resolveAppIcon } from "./util/app-icon";
import { planShowDesktop } from "./util/show-desktop";
import { useIsomorphicLayoutEffect } from "./util/use-isomorphic-layout-effect";
import { useReducedMotion } from "./util/use-reduced-motion";
import { useViewportMode } from "./util/viewport-mode";

export { DOCK_HEIGHT, DOCK_WIDTH } from "./util/layout";

// Cursor-tracking magnification, the macOS dock's signature gesture: the icon
// under the cursor grows, its neighbors fall off over a fixed influence radius,
// and the dock makes room.
//
// The reference smooths every size change with an overdamped spring (mass 0.1,
// stiffness 170, damping 12), which is what keeps it from feeling abrupt. We
// reproduce that character: each frame, every tile's size eases toward its
// cursor-driven target (exponential smoothing, no overshoot, like an overdamped
// spring), and the box and icon scale together from the same value so nothing
// snaps. The peak is kept gentle (1.5x of a 56 px tile, ~84 px) so it reads like
// the macOS default rather than the slider maximum.
// Sources: macOS System Settings > Desktop & Dock > Magnification;
// https://buildui.com/recipes/magnified-dock
const MAG_SCALE = 1.5;
const MAG_DISTANCE = 140;
// Time constant of the size easing, in seconds. ~50 ms reads as responsive but
// smooth, settling in roughly 150 ms.
const SMOOTH_TAU = 0.05;

// Width of the Windows "Show desktop" corner sliver. Windows 11 keeps it a thin
// strip past the clock; a click toggles minimize-all.
const SHOW_DESKTOP_WIDTH = 12;

// How close to the screen edge (px) the pointer must come to reveal an
// auto-hidden bar. A thin strip matches Windows "slam to the edge" reveal.
const AUTO_HIDE_EDGE = 3;

/**
 * App dock. Direction follows `theme.chrome.dockPosition`:
 *
 *   "bottom"  horizontal pill centered at the bottom of the desktop
 *   "left"    vertical rail centered on the left edge
 *   "hidden"  returns null
 *
 * Hovering magnifies the icons under the cursor (the macOS fisheye) with a
 * smooth, spring-like response. Clicking a tile toggles: open if not running,
 * focus + restore if minimized or unfocused, otherwise minimize.
 */
export function Dock() {
  const theme = useTheme();
  const apps = useApps();
  const { state, openWindow } = useWindowManager();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const position = theme.chrome.dockPosition;

  const isLeft = position === "left";
  const isBar = theme.chrome.dockStyle === "bar";
  const base = getDockTileSize(theme, mode);
  // Bar thickness (Windows taskbar height / Ubuntu dock width) and top-bar
  // height both follow the theme's per-platform sizing.
  const barThickness = getBarThickness(theme, mode);
  const menuBarH = getMenuBarHeight(theme);
  const gap = isBar ? 4 : metrics.dockGap;
  const span = base + gap;
  const count = apps.length;
  const mag = theme.motion.dockMagnification ?? MAG_SCALE;
  const reducedMotion = useReducedMotion();
  // Auto-hide: the bar tucks off the edge and slides back only while the
  // pointer is at that edge or over the bar (the Windows taskbar behavior).
  const autoHide = isBar && (theme.chrome.dockAutoHide ?? false);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  const [sizes, setSizes] = useState<number[]>(() => apps.map(() => base));
  const sizesRef = useRef<number[]>(sizes);
  const cursorRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  // Latest geometry, refreshed every render so the animation loop (which is
  // created once) always reads current values.
  const geomRef = useRef({ count, base, span, isLeft, mag });
  geomRef.current = { count, base, span, isLeft, mag };

  const tick = useCallback((ts: number) => {
    const dt = lastRef.current ? Math.min((ts - lastRef.current) / 1000, 0.05) : 0.016;
    lastRef.current = ts;
    const k = 1 - Math.exp(-dt / SMOOTH_TAU);
    const g = geomRef.current;
    const cursor = cursorRef.current;
    const center =
      typeof window === "undefined"
        ? 0
        : (g.isLeft ? window.innerHeight : window.innerWidth) / 2;
    const prev = sizesRef.current;
    let moving = false;
    const next: number[] = [];
    for (let i = 0; i < g.count; i++) {
      let target = g.base;
      if (cursor !== null) {
        const off = (i - (g.count - 1) / 2) * g.span;
        const d = Math.abs(cursor - center - off);
        const t = Math.max(0, 1 - d / MAG_DISTANCE);
        const ease = t * t * (3 - 2 * t);
        target = g.base * (1 + (g.mag - 1) * ease);
      }
      const c0 = prev[i] ?? g.base;
      let v = c0 + (target - c0) * k;
      if (Math.abs(target - v) < 0.3) v = target;
      else moving = true;
      next.push(v);
    }
    sizesRef.current = next;
    setSizes(next);
    if (moving || cursorRef.current !== null) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
      lastRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current === null) {
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  // Keep the size array in sync when the app list changes or the resting tile
  // size does. The magnification loop parks at rest and only eases during a
  // hover, so a `base` change while parked (the viewport crossing the compact
  // threshold) has to be snapped here, or the tiles keep their old size until
  // the next hover. A layout effect applies it before paint, so the corrected
  // size never flashes (matters when an SSR'd desktop hydrates into a small
  // viewport and first paints at the regular size).
  useIsomorphicLayoutEffect(() => {
    if (sizesRef.current.length !== count) {
      const resized = Array.from(
        { length: count },
        (_, i) => sizesRef.current[i] ?? base,
      );
      sizesRef.current = resized;
      setSizes(resized);
      return;
    }
    if (rafRef.current === null && sizesRef.current.some((s) => s !== base)) {
      const resized = Array.from({ length: count }, () => base);
      sizesRef.current = resized;
      setSizes(resized);
    }
  }, [count, base]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Reveal/hide an auto-hiding bar from the pointer's distance to its edge.
  // Hysteresis: reveal only at the very edge, hide once the pointer climbs back
  // past the bar's own thickness, so the bar doesn't flicker along its inner
  // border. Coordinate math avoids enter/leave fighting between the bar and a
  // reveal strip.
  const taskbarSize = barThickness;
  useEffect(() => {
    if (!autoHide || typeof window === "undefined") {
      setRevealed(false);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const dist = isLeft ? e.clientX : window.innerHeight - e.clientY;
      if (!revealedRef.current) {
        if (dist <= AUTO_HIDE_EDGE) setRevealed(true);
      } else if (dist > taskbarSize) {
        setRevealed(false);
      }
    };
    const onLeave = () => {
      setRevealed(false);
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [autoHide, isLeft, taskbarSize]);

  if (position === "hidden") return null;

  const crossSize = base + metrics.dockPadding * 2 + 2;

  const topMenuBar = theme.chrome.menuBar === "top";
  // When a top menu bar already owns the clock and status tray (the GNOME
  // layout: top bar plus a left dock), the dock drops its own tray and moves
  // the launcher to the trailing edge, where Ubuntu's "Show Applications" grid
  // sits. The Windows register (bottom bar, no menu bar) keeps both.
  const showTray = isBar && !topMenuBar;
  const launcherTrailing = isBar && isLeft && topMenuBar;
  // The Windows "Show desktop" sliver lives in the far bottom-right corner, so
  // it only applies to a horizontal bar. When present, the tray shifts inward
  // to leave the corner clear.
  const showDesktop = isBar && !isLeft && (theme.chrome.showDesktopButton ?? false);
  // The Task View button sits beside the launcher in the leading cluster, so it
  // only applies to a horizontal bar with the launcher at the leading edge.
  const taskView =
    isBar && !isLeft && !launcherTrailing && (theme.chrome.taskViewButton ?? false);
  const taskbarMenu = isBar && (theme.chrome.taskbarContextMenu ?? false);

  // Bar-dock icon alignment along the long axis. macOS / Windows 11 center;
  // GNOME / Ubuntu and Windows 10 pack from the start. When not centered, the
  // run is inset so it clears the absolutely-positioned launcher and tray; a
  // free edge keeps a small breathing gap.
  const align = theme.chrome.dockAlign ?? "center";
  const barJustify =
    align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center";
  const LAUNCHER_SLOT = 44;
  const FREE_EDGE = 8;
  // Windows rides the launcher (and Task View) inside the icon run, so the whole
  // cluster centers together; Ubuntu pins its launcher to the trailing edge.
  // Only an edge-pinned launcher (or the trailing tray) needs the run inset to
  // clear it; with the cluster inline the leading side just wants a breathing
  // gap when packed from the start.
  const launcherInline = isBar && !launcherTrailing;
  const leadingPad = align === "center" ? 0 : FREE_EDGE;
  const trailingPad =
    align === "center"
      ? 0
      : launcherTrailing
        ? base + 12
        : isBar && showTray
          ? LAUNCHER_SLOT
          : FREE_EDGE;
  // Map leading/trailing onto the long axis: top/bottom for a left bar,
  // left/right for a bottom bar.
  const barPadding = isLeft
    ? `${String(leadingPad)}px 0 ${String(trailingPad)}px`
    : `0 ${String(trailingPad)}px 0 ${String(leadingPad)}px`;

  const handleMove = (e: ReactPointerEvent) => {
    cursorRef.current = isLeft ? e.clientY : e.clientX;
    startLoop();
  };
  const handleLeave = () => {
    cursorRef.current = null;
    startLoop();
  };

  // Right-click on the empty bar opens "Taskbar settings", the Windows 11 entry
  // point to taskbar customization. App tiles and the tray/launcher buttons
  // keep their own menus, so bail when the click landed on a button.
  const handleBarContextMenu = (e: React.MouseEvent) => {
    if (!taskbarMenu) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const payload = { kind: "system" as const, systemId: "settings" };
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      ariaLabel: "Taskbar",
      items: [
        {
          label: "Taskbar settings",
          onSelect: () => {
            // Request the section first so a fresh Settings window reads it on
            // mount; an already-open one switches via the subscription.
            requestSettingsSection("Taskbar");
            openWindow(
              payload,
              pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
            );
          },
        },
      ],
    });
  };

  // Name label over the icon under the cursor. The floating dock finds that
  // icon from the magnification offsets (its tiles resize, so positions are
  // synthetic and glide with the eased sizes). A bar never magnifies, so it
  // hit-tests the cursor against the real tile rects instead: that keeps the
  // label aligned for any packing (centered, left) and any leading cluster,
  // where the synthetic offsets would assume a centered run and miss.
  const cursorNow = cursorRef.current;

  let floatIndex = -1;
  let floatDist = Infinity;
  if (!isBar && cursorNow !== null && typeof window !== "undefined") {
    const center = (isLeft ? window.innerHeight : window.innerWidth) / 2;
    apps.forEach((_, i) => {
      const off = (i - (count - 1) / 2) * span;
      const d = Math.abs(cursorNow - center - off);
      if (d < floatDist) {
        floatDist = d;
        floatIndex = i;
      }
    });
  }
  const focusedSize = floatIndex >= 0 ? (sizes[floatIndex] ?? base) : base;
  let labelOffset = metrics.dockPadding;
  for (let i = 0; i < floatIndex; i++) {
    labelOffset += (sizes[i] ?? base) + gap;
  }
  if (floatIndex >= 0) labelOffset += focusedSize / 2;

  let barIndex = -1;
  let barLabelMain = 0;
  if (isBar && cursorNow !== null && typeof document !== "undefined") {
    for (let i = 0; i < count; i++) {
      const app = apps[i];
      if (!app) continue;
      const el = document.querySelector<HTMLElement>(
        `[data-dock-app-id="${app.id}"]`,
      );
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const lo = isLeft ? r.top : r.left;
      const hi = isLeft ? r.bottom : r.right;
      if (cursorNow >= lo && cursorNow <= hi) {
        barIndex = i;
        // Nav-relative center from the tile's own offset box, so the absolutely
        // positioned label lands on the icon regardless of where the nav sits
        // (a left bar starts below the menu bar) or any transformed ancestor.
        barLabelMain = isLeft
          ? el.offsetTop + el.offsetHeight / 2
          : el.offsetLeft + el.offsetWidth / 2;
        break;
      }
    }
  }

  const focusedIndex = isBar ? barIndex : floatIndex;
  const focusedApp = focusedIndex >= 0 ? apps[focusedIndex] : undefined;
  const showLabel =
    focusedApp !== undefined && (isBar || floatDist < MAG_DISTANCE * 0.55);

  const navStyle: CSSProperties = {
    position: "fixed",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: isLeft ? "column" : "row",
    backgroundColor: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    overflow: "visible",
    zIndex: 1200,
    userSelect: "none",
    ...(isBar
      ? {
          // Flush taskbar: full span, square, only an edge-facing hairline.
          alignItems: "center",
          justifyContent: barJustify,
          gap,
          padding: barPadding,
          borderRadius: 0,
          ...(isLeft
            ? {
                left: 0,
                // Sit below the top menu bar when there is one, so the bar can
                // span the full width above the dock (the GNOME arrangement).
                top: topMenuBar ? menuBarH : 0,
                bottom: 0,
                width: barThickness,
                borderRight: `1px solid ${theme.palette.border}`,
                boxShadow: "1px 0 8px rgba(0,0,0,0.12)",
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                height: barThickness,
                borderTop: `1px solid ${theme.palette.border}`,
                boxShadow: "0 -1px 8px rgba(0,0,0,0.12)",
              }),
          // Auto-hide slide. Reuse the genie translate timing: same character,
          // a system surface moving on and off the screen edge.
          ...(autoHide
            ? {
                transform: revealed
                  ? "none"
                  : isLeft
                    ? "translateX(-100%)"
                    : "translateY(100%)",
                transition: reducedMotion
                  ? undefined
                  : `transform ${String(theme.motion.genieDurationMs)}ms ${theme.motion.genieEasing}`,
                willChange: "transform",
              }
            : {}),
        }
      : {
          // Floating macOS pill: centered, offset from the edge, rounded.
          alignItems: isLeft ? "flex-start" : "flex-end",
          gap,
          padding: metrics.dockPadding,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: theme.shape.dockTileRadius + metrics.dockPadding - 4,
          boxShadow: "0 12px 32px -8px rgba(0,0,0,0.45)",
          ...(isLeft
            ? {
                left: metrics.dockEdgeOffset,
                top: "50%",
                transform: "translateY(-50%)",
                width: crossSize,
              }
            : {
                bottom: metrics.dockEdgeOffset,
                left: "50%",
                transform: "translateX(-50%)",
                height: crossSize,
              }),
        }),
  };

  return (
    <nav
      aria-label="App dock"
      data-dock-position={position}
      data-rui-dock=""
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onContextMenu={taskbarMenu ? handleBarContextMenu : undefined}
      style={navStyle}
    >
      {launcherInline && <StartButton inline vertical={isLeft} tile={base} />}
      {launcherInline && taskView && <TaskViewButton tile={base} />}
      {apps.map((app, i) => (
        <DockTile
          key={app.id}
          app={app}
          position={position}
          bar={isBar}
          size={Math.round(sizes[i] ?? base)}
          base={base}
        />
      ))}
      {showLabel && focusedApp ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            ...(isBar
              ? isLeft
                ? {
                    top: barLabelMain,
                    left: barThickness + 8,
                    transform: "translateY(-50%)",
                  }
                : {
                    left: barLabelMain,
                    bottom: barThickness + 8,
                    transform: "translateX(-50%)",
                  }
              : isLeft
                ? {
                    top: labelOffset,
                    left: metrics.dockPadding + focusedSize + 12,
                    transform: "translateY(-50%)",
                  }
                : {
                    left: labelOffset,
                    bottom: metrics.dockPadding + focusedSize + 12,
                    transform: "translateX(-50%)",
                  }),
            pointerEvents: "none",
            background: theme.palette.surface,
            backdropFilter: theme.blur.surface,
            WebkitBackdropFilter: theme.blur.surface,
            border: `1px solid ${theme.palette.border}`,
            borderRadius: theme.shape.small,
            padding: "3px 9px",
            fontSize: 12,
            fontWeight: 500,
            color: theme.palette.textPrimary,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 16px -8px rgba(0,0,0,0.5)",
          }}
        >
          {focusedApp.name}
        </span>
      ) : null}
      {launcherTrailing && <StartButton vertical={isLeft} trailing tile={base} />}
      {showTray && (
        <TaskbarTray vertical={isLeft} trailingInset={showDesktop ? SHOW_DESKTOP_WIDTH : 0} />
      )}
      {showDesktop && <ShowDesktopButton />}
    </nav>
  );
}

/**
 * Taskbar launcher. Its glyph follows `chrome.launcher`: the Windows Start
 * four-pane mark for the `"menu"` Start menu, the GNOME "Show Applications"
 * dot grid for the `"grid"` overview, and a neutral 2x2 grid otherwise. All are
 * original drawings, not vendor artwork. `inline` rides it inside the icon run
 * so the whole cluster centers (Windows 11); otherwise it pins to an edge
 * (Ubuntu's trailing launcher).
 */
function StartButton({
  vertical,
  trailing = false,
  inline = false,
  tile = 32,
}: {
  vertical: boolean;
  trailing?: boolean;
  inline?: boolean;
  tile?: number;
}) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}14`;
  // Real Ubuntu / Windows make the launcher a full dock item, the same size as
  // the app tiles, so size the button and its glyph to match the run.
  const glyph = Math.round(tile * (theme.chrome.dockIconScale ?? 0.5));
  return (
    <button
      type="button"
      aria-label="Open launcher"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT));
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        ...(inline
          ? { position: "relative", flexShrink: 0 }
          : {
              position: "absolute",
              ...(vertical
                ? trailing
                  ? { bottom: 6, left: "50%", transform: "translateX(-50%)" }
                  : { top: 6, left: "50%", transform: "translateX(-50%)" }
                : trailing
                  ? { right: 8, top: "50%", transform: "translateY(-50%)" }
                  : { left: 8, top: "50%", transform: "translateY(-50%)" }),
            }),
        width: tile,
        height: tile,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        borderRadius: theme.shape.small,
        cursor: "pointer",
        color: theme.palette.accent,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
    >
      <LauncherGlyph
        icon={theme.chrome.launcherIcon ?? launcherGlyphFor(theme.chrome.launcher)}
        size={glyph}
      />
    </button>
  );
}

type LauncherGlyphName = NonNullable<OsTheme["chrome"]["launcherIcon"]>;

/** The glyph a launcher style defaults to when the theme sets no launcherIcon. */
function launcherGlyphFor(launcher: OsTheme["chrome"]["launcher"]): LauncherGlyphName {
  if (launcher === "menu") return "windows";
  if (launcher === "grid") return "grid";
  return "dots";
}

/**
 * Launcher button glyph. Original drawings, not traced from vendor artwork:
 *
 *   "windows"  the Windows Start mark, four flat panes with a hairline gap
 *   "grid"     the GNOME "Show Applications" 9-dot grid
 *   "ubuntu"   the Ubuntu Circle of Friends (current Ubuntu's Show Apps mark)
 *   "dots"     a neutral 2x2 grid (the macOS / generic launcher)
 */
function LauncherGlyph({ icon, size = 16 }: { icon: LauncherGlyphName; size?: number }) {
  if (icon === "windows") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <rect x="1.4" y="1.4" width="5.7" height="5.7" rx="0.6" />
        <rect x="8.9" y="1.4" width="5.7" height="5.7" rx="0.6" />
        <rect x="1.4" y="8.9" width="5.7" height="5.7" rx="0.6" />
        <rect x="8.9" y="8.9" width="5.7" height="5.7" rx="0.6" />
      </svg>
    );
  }
  if (icon === "grid") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        {[3, 8, 13].map((cy) =>
          [3, 8, 13].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />),
        )}
      </svg>
    );
  }
  if (icon === "ubuntu") {
    // The Ubuntu Circle of Friends: three "heads" on a ring, 120 degrees apart.
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="3" r="1.75" />
        <circle cx="3.67" cy="10.5" r="1.75" />
        <circle cx="12.33" cy="10.5" r="1.75" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  );
}

/**
 * Task View button, beside Start in the taskbar's leading cluster. Opens the
 * all-windows overview (Mission Control), the Windows 11 "Task View" button
 * (Win+Tab). The glyph is two stacked window outlines, the Windows mark.
 * Source: https://support.microsoft.com/en-us/windows/customize-the-taskbar-in-windows-0657a50f-0cc7-dbfd-ae6b-05020b195b07
 */
function TaskViewButton({ tile = 32 }: { tile?: number }) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}14`;
  const glyph = Math.round(tile * (theme.chrome.dockIconScale ?? 0.5));
  return (
    <button
      type="button"
      aria-label="Task view"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(MISSION_CONTROL_TOGGLE_EVENT));
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        // Rides in the leading cluster just after Start, sized to the taskbar
        // tile so the whole group reads as one row.
        position: "relative",
        flexShrink: 0,
        width: tile,
        height: tile,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        borderRadius: theme.shape.small,
        cursor: "pointer",
        color: theme.palette.textPrimary,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="4.5" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <rect
          x="2.5"
          y="6.5"
          width="9"
          height="8"
          rx="1.5"
          fill={theme.palette.surface}
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    </button>
  );
}

/**
 * The "Show desktop" sliver at the far bottom-right corner of the Windows
 * taskbar. One click minimizes every window on the active workspace; a second
 * click restores the set it minimized (or, if the user minimized everything by
 * hand, all of them). Mirrors the Win+D toggle and the thin corner button
 * Windows 11 exposes via "Select the far corner of the taskbar to show the
 * desktop".
 * Source: https://support.microsoft.com/en-us/windows/customize-the-taskbar-in-windows-0657a50f-0cc7-dbfd-ae6b-05020b195b07
 */
function ShowDesktopButton() {
  const theme = useTheme();
  const { state, windows, minimizeWindow, restoreWindow } = useWindowManager();
  // The set we last minimized, so the next click restores exactly those.
  const stashRef = useRef<string[]>([]);

  const handleClick = () => {
    const plan = planShowDesktop(windows, state.activeWorkspaceId, stashRef.current);
    plan.minimize.forEach((id) => {
      minimizeWindow(id);
    });
    plan.restore.forEach((id) => {
      restoreWindow(id);
    });
    stashRef.current = plan.nextStash;
  };

  const hover = `${theme.palette.textPrimary}14`;
  return (
    <button
      type="button"
      aria-label="Show desktop"
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: SHOW_DESKTOP_WIDTH,
        border: "none",
        // A faint hairline on the leading edge marks the sliver, as Windows
        // separates it from the clock with a thin divider.
        borderLeft: `1px solid ${theme.palette.border}`,
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
    />
  );
}

/**
 * Taskbar system tray pinned to the trailing edge: the registered status
 * items and a clock (time over date), the cluster Windows keeps bottom-right.
 * Clicking the clock toggles the Notification Center, as the Windows clock
 * opens the notification panel.
 */
function TaskbarTray({
  vertical,
  trailingInset = 0,
}: {
  vertical: boolean;
  trailingInset?: number;
}) {
  const theme = useTheme();
  const items = useSyncExternalStore(
    subscribeStatusItems,
    listStatusItems,
    listStatusItems,
  );
  const { unreadCount } = useNotifications();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Mount-time read avoids the SSR "rendered HH:MM != current" mismatch.
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const hover = `${theme.palette.textPrimary}14`;
  const time = now
    ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const date = now ? now.toLocaleDateString() : "";

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: 2,
        ...(vertical
          ? { left: 0, right: 0, bottom: 6, flexDirection: "column" }
          : { right: 6 + trailingInset, top: 0, bottom: 0 }),
      }}
    >
      {items.map((item) => (
        <TrayStatusItem key={item.id} item={item} />
      ))}
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(NOTIFICATION_CENTER_TOGGLE_EVENT));
        }}
        aria-label={
          unreadCount > 0
            ? `${String(unreadCount)} unread notifications. Open Notification Center.`
            : "Clock and notifications"
        }
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        style={{
          position: "relative",
          appearance: "none",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: theme.shape.small,
          padding: vertical ? "4px 6px" : "0 8px",
          height: vertical ? undefined : "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: vertical ? "center" : "flex-end",
          justifyContent: "center",
          gap: 1,
          color: theme.palette.textPrimary,
          fontFamily: "inherit",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
          transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
        }}
      >
        {unreadCount > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: theme.palette.accent,
            }}
          />
        )}
        <span style={{ fontSize: 11 }}>{time}</span>
        {!vertical && (
          <span style={{ fontSize: 11, color: theme.palette.textSecondary }}>
            {date}
          </span>
        )}
      </button>
    </div>
  );
}

function TrayStatusItem({ item }: { item: StatusItem }) {
  const theme = useTheme();
  const hover = `${theme.palette.textPrimary}14`;
  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!item.onClick}
      aria-label={item.tooltip ?? item.id}
      onMouseEnter={(e) => {
        if (item.onClick) e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        position: "relative",
        appearance: "none",
        border: "none",
        background: "transparent",
        cursor: item.onClick ? "pointer" : "default",
        borderRadius: theme.shape.small,
        padding: 5,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.palette.textSecondary,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
    >
      {item.icon}
      {item.badge !== undefined && item.badge !== "" && item.badge !== 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -1,
            right: -1,
            minWidth: 12,
            height: 12,
            borderRadius: 6,
            background: theme.palette.accent,
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            padding: "0 3px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {String(item.badge)}
        </span>
      )}
    </button>
  );
}

function DockTile({
  app,
  position,
  bar,
  size,
  base,
}: {
  app: App;
  position: "bottom" | "left" | "hidden";
  bar: boolean;
  size: number;
  base: number;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const apps = useApps();
  const {
    state,
    windows,
    focusedWindow,
    openWindow,
    focusWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
  } = useWindowManager();
  const { unreadByApp } = useNotifications();
  const id = windowIdOf({ kind: "app", appId: app.id });
  const win = windows.find((w) => w.id === id);
  const isFocused = focusedWindow?.id === id;
  const isMinimized = win?.state === "minimized";
  const badgeCount = unreadByApp[app.id] ?? 0;
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [];
    if (!win) {
      items.push({
        label: `Open ${app.name}`,
        onSelect: () =>
          openWindow(
            { kind: "app", appId: app.id },
            pickInitialBounds(
              { kind: "app", appId: app.id },
              theme,
              apps,
              undefined,
              nextCascadeIndex(state),
            ),
          ),
      });
    } else {
      items.push({
        label: isFocused ? "Window in front" : "Bring to front",
        disabled: isFocused && !isMinimized,
        onSelect: () => {
          if (isMinimized) restoreWindow(id);
          else focusWindow(id);
        },
      });
      items.push({
        label: isMinimized ? "Restore" : "Minimize",
        shortcut: isMinimized ? undefined : "⌘M",
        onSelect: () => (isMinimized ? restoreWindow(id) : minimizeWindow(id)),
      });
      items.push({
        label: "Close",
        shortcut: "⌘W",
        onSelect: () => closeWindow(id),
      });
    }
    if (badgeCount > 0) {
      items.push({ separator: true });
      items.push({
        label: `Mark ${String(badgeCount)} notification${badgeCount === 1 ? "" : "s"} as read`,
        onSelect: () => markAllNotificationsRead(),
      });
    }
    if (items.length === 0) return;
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
      ariaLabel: `${app.name} dock menu`,
    });
  };

  const handleClick = () => {
    if (!win) {
      openWindow(
        { kind: "app", appId: app.id },
        pickInitialBounds(
          { kind: "app", appId: app.id },
          theme,
          apps,
          undefined,
          nextCascadeIndex(state),
        ),
      );
      // Windows taskbar buttons do not bounce on launch; the macOS dock does.
      // macOS itself drops the bounce under reduced motion, so we do too.
      if (!bar && !reducedMotion) bounce(buttonRef.current, position === "left");
      return;
    }
    if (isMinimized) {
      restoreWindow(id);
      return;
    }
    if (!isFocused) {
      focusWindow(id);
      return;
    }
    minimizeWindow(id);
  };

  const accent = app.accent ?? theme.palette.accent;
  // Icon size as a fraction of the tile, per platform: Windows ~0.6 (24px in a
  // 40px tile), Ubuntu ~0.82 (icons nearly fill the dock), macOS ~0.6. Full-art
  // icons fill a little more than a stroke glyph.
  const glyphScale = theme.chrome.dockIconScale ?? 0.5;
  const artScale = Math.min(glyphScale + 0.2, 0.92);
  const Art = app.iconArt;
  const Icon = resolveAppIcon(app, theme);
  const isLeft = position === "left";
  const dur = theme.motion.dockHoverDurationMs;
  // The taskbar button is a flat icon button (transparent, hover-highlighted,
  // brand-colored glyph); the floating dock tile is an accent-gradient squircle.
  const radius = bar
    ? theme.shape.small
    : Math.round(theme.shape.dockTileRadius * (size / base));
  const hoverBg = `${theme.palette.textPrimary}14`;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      aria-label={app.name}
      data-dock-app-id={app.id}
      onMouseEnter={(e) => {
        if (bar) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (bar) e.currentTarget.style.background = "transparent";
      }}
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: "none",
        borderRadius: radius,
        background: bar
          ? "transparent"
          : `linear-gradient(180deg, ${accent} 0%, ${accent}c0 100%)`,
        boxShadow: bar
          ? "none"
          : "inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.35)",
        cursor: "pointer",
        color: bar ? accent : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: bar ? `background ${String(dur)}ms ease` : undefined,
      }}
    >
      {Art ? (
        <Art size={Math.round(size * artScale)} />
      ) : Icon ? (
        <Icon size={Math.round(size * glyphScale)} />
      ) : (
        <span
          style={{
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: Math.round(size * (glyphScale - 0.1)),
            textShadow: bar ? undefined : "0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {app.name.charAt(0).toUpperCase()}
        </span>
      )}
      {win &&
        (bar ? (
          // Windows-style running indicator: an accent underline beneath the
          // icon, wider when focused, a short dim line when running unfocused.
          <span
            aria-hidden
            style={{
              position: "absolute",
              borderRadius: 2,
              backgroundColor: isFocused ? accent : theme.palette.textSecondary,
              opacity: isFocused ? 1 : 0.7,
              transition: `width ${String(dur)}ms ease, height ${String(dur)}ms ease, opacity ${String(dur)}ms ease`,
              ...(isLeft
                ? {
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: isFocused ? 16 : 8,
                  }
                : {
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: isFocused ? 16 : 8,
                    height: 3,
                  }),
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              position: "absolute",
              ...(isLeft
                ? { right: -6, top: "50%", transform: "translateY(-50%)" }
                : { bottom: -6, left: "50%", transform: "translateX(-50%)" }),
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: isFocused
                ? theme.palette.textPrimary
                : theme.palette.textSecondary,
              opacity: isFocused ? 1 : 0.6,
              transition: `opacity ${String(dur)}ms ease`,
            }}
          />
        ))}
      {badgeCount > 0 && (
        <span
          aria-label={`${String(badgeCount)} unread notifications`}
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            background: "#ef4444",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.55)",
            lineHeight: 1,
          }}
        >
          {badgeCount > 99 ? "99+" : String(badgeCount)}
        </span>
      )}
    </button>
  );
}

// macOS-style launch bounce when a dock click opens an app. Uses the Web
// Animations API so it composes with the magnification (which drives the tile
// size, not transform) and leaves no residual transform behind.
function bounce(el: HTMLButtonElement | null, isLeft: boolean): void {
  if (!el || typeof el.animate !== "function") return;
  const up = isLeft ? "translateX(18px)" : "translateY(-18px)";
  const up2 = isLeft ? "translateX(7px)" : "translateY(-7px)";
  const rest = "translate(0, 0)";
  el.animate(
    [
      { transform: rest },
      { transform: up, offset: 0.3 },
      { transform: rest, offset: 0.55 },
      { transform: up2, offset: 0.78 },
      { transform: rest, offset: 1 },
    ],
    { duration: 560, easing: "ease-out" },
  );
}

/** Returns the DOMRect of a dock tile by its app id, if mounted. */
export function getDockTileRect(appId: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-dock-app-id="${appId}"]`);
  return el ? el.getBoundingClientRect() : null;
}
