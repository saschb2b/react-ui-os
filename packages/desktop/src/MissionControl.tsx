"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useWindowManager, type OpenWindow } from "@react-ui-os/core";
import { useApps, useTheme } from "./desktop-context";
import { getSystemWindow, resolveSystemWindowName } from "./system-windows";

type Phase = "closed" | "enter" | "open" | "leave";

// Each thumbnail is the real window (chrome + content) rendered at full size
// and scaled down, so it reads as a faithful miniature like macOS. Windows are
// fit into a shared envelope so a small utility and a large document end up at
// comparable, recognizable sizes rather than one dwarfing the other.
const THUMB_MAX_W = 380;
const THUMB_MAX_H = 280;
const THUMB_MAX_SCALE = 0.9;
const MINI_TITLE_BAR_H = 30;

/**
 * Mission Control: press F3 (or Ctrl+Up on non-Mac keyboards) and every open
 * window spreads into a non-overlapping set of preview cards. Click a card to
 * focus that window and collapse back; click empty space or press Esc to
 * collapse without switching.
 *
 * Each card is a live, scaled re-render of the window's own chrome and content,
 * with the app name on a readable label beneath it (scaled title text is too
 * small to read, so macOS labels separately too). The preview mounts a second,
 * inert instance of the content while Mission Control is open, so it shows the
 * real UI but not unsaved live state; an error boundary keeps a misbehaving
 * preview from tearing down the overlay.
 *
 * Self-mounted by `<Desktop>`. Drop down to `<DesktopProvider>` and skip it if
 * you want to replace it.
 */
export function MissionControl() {
  const theme = useTheme();
  const apps = useApps();
  const { state, windows, focusWindow, restoreWindow, switchWorkspace } =
    useWindowManager();

  const [phase, setPhase] = useState<Phase>("closed");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [keyIndex, setKeyIndex] = useState(-1);

  const duration = theme.motion.missionControlDurationMs;
  const easing = theme.motion.missionControlEasing;

  // Show the current space only, minus minimized windows (those live in the
  // dock). The Spaces bar switches which space is shown, like macOS.
  const activeWorkspace = state.activeWorkspaceId;
  const visible = useMemo<OpenWindow[]>(
    () =>
      windows.filter(
        (w) => w.state !== "minimized" && w.workspaceId === activeWorkspace,
      ),
    [windows, activeWorkspace],
  );
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const keyIndexRef = useRef(keyIndex);
  keyIndexRef.current = keyIndex;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return;
      }
      const showing = phaseRef.current === "enter" || phaseRef.current === "open";
      // Ctrl + ArrowUp is the Mac convention for Mission Control on PCs.
      if (e.key === "F3" || (e.ctrlKey && !e.metaKey && e.key === "ArrowUp")) {
        e.preventDefault();
        setPhase(showing ? "leave" : "enter");
        return;
      }
      if (!showing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setPhase("leave");
        return;
      }
      const vis = visibleRef.current;
      if (vis.length === 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setKeyIndex((idx) => (idx < 0 ? 0 : (idx + 1) % vis.length));
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setKeyIndex((idx) =>
          idx < 0 ? vis.length - 1 : (idx - 1 + vis.length) % vis.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const idx = keyIndexRef.current;
        const w = idx >= 0 ? vis[idx] : undefined;
        if (w) {
          e.preventDefault();
          if (w.state === "minimized") restoreWindow(w.id);
          else focusWindow(w.id);
          setPhase("leave");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Phase machine (animations are state machines, not effects): "enter" paints
  // the collapsed state for one frame, then flips to "open" so the CSS
  // transition runs the spread. "leave" reverses it, then unmounts once the
  // collapse has finished playing.
  useEffect(() => {
    if (phase === "enter") {
      const id = window.requestAnimationFrame(() => {
        setPhase("open");
      });
      return () => {
        window.cancelAnimationFrame(id);
      };
    }
    if (phase === "leave") {
      const id = window.setTimeout(() => {
        setPhase("closed");
      }, duration);
      return () => {
        window.clearTimeout(id);
      };
    }
    return undefined;
  }, [phase, duration]);

  useEffect(() => {
    // Reset the keyboard selection each time the overlay closes.
    if (phase === "closed") setKeyIndex(-1);
  }, [phase]);

  if (phase === "closed") return null;

  const expanded = phase === "open";
  const close = () => {
    setPhase("leave");
  };
  const pick = (win: OpenWindow) => {
    if (win.state === "minimized") restoreWindow(win.id);
    else focusWindow(win.id);
    setPhase("leave");
  };

  return (
    <div
      role="dialog"
      aria-label="Mission Control"
      onClick={(e) => {
        // A click on empty space collapses Mission Control; clicks on a card
        // or a space chip are handled by those controls.
        if ((e.target as HTMLElement).closest("[data-mc-card], [data-mc-space]"))
          return;
        close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1450,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 5vmin, 56px)",
        boxSizing: "border-box",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          // The wallpaper stays visible, lightly dimmed. macOS moved away from
          // a solid dark panel to a translucent scrim in OS X El Capitan.
          background: "rgba(0,0,0,0.38)",
          backdropFilter: theme.blur.surface,
          WebkitBackdropFilter: theme.blur.surface,
          opacity: expanded ? 1 : 0,
          transition: `opacity ${String(duration)}ms ${easing}`,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "min(1320px, 100%)",
          maxHeight: "100%",
          overflowY: "auto",
          transformOrigin: "center",
          transform: expanded ? "scale(1)" : "scale(0.96)",
          opacity: expanded ? 1 : 0,
          transition: `transform ${String(duration)}ms ${easing}, opacity ${String(duration)}ms ${easing}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "clamp(20px, 4vmin, 44px)",
          }}
        >
          {state.workspaces.length > 1 ? (
            <SpacesBar
              workspaces={state.workspaces}
              activeId={state.activeWorkspaceId}
              onSwitch={switchWorkspace}
              windows={windows}
              wallpaperSrc={theme.wallpaper.src}
              theme={theme}
            />
          ) : null}
          {visible.length === 0 ? (
            <EmptyState theme={theme} />
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: "clamp(16px, 2.6vmin, 34px)",
              }}
            >
              {visible.map((win, i) => (
                <Card
                  key={win.id}
                  win={win}
                  apps={apps}
                  theme={theme}
                  selected={i === keyIndex}
                  onPick={() => {
                    pick(win);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <div
      style={{
        color: theme.palette.textPrimary,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontSize: 24, opacity: 0.7, marginBottom: 6 }}>Nothing to show</div>
      <div style={{ color: theme.palette.textSecondary, fontSize: 12 }}>
        Open an app first, then press F3 to see them all at once.
      </div>
    </div>
  );
}

function SpacesBar({
  workspaces,
  activeId,
  onSwitch,
  windows,
  wallpaperSrc,
  theme,
}: {
  workspaces: string[];
  activeId: string;
  onSwitch: (id: string) => void;
  windows: OpenWindow[];
  wallpaperSrc: string | undefined;
  theme: ReturnType<typeof useTheme>;
}) {
  // Viewport used to place the miniature window outlines inside each space
  // thumbnail, so the Spaces bar shows which windows live where (like macOS).
  const vw = typeof window === "undefined" ? 1600 : window.innerWidth || 1600;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight || 900;
  return (
    <div
      role="tablist"
      aria-label="Spaces"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      {workspaces.map((id, i) => {
        const active = id === activeId;
        const spaceWindows = windows.filter(
          (w) => w.workspaceId === id && w.state !== "minimized",
        );
        return (
          <button
            key={id}
            type="button"
            role="tab"
            data-mc-space
            aria-selected={active}
            aria-label={`Desktop ${String(i + 1)}`}
            onClick={() => {
              onSwitch(id);
            }}
            onPointerEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.opacity = active ? "1" : "0.6";
            }}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity: active ? 1 : 0.6,
              transition: `opacity ${String(theme.motion.dockHoverDurationMs)}ms ease`,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "relative",
                display: "block",
                width: 124,
                height: 74,
                borderRadius: theme.shape.small,
                border: active
                  ? "2px solid rgba(255,255,255,0.85)"
                  : `1px solid ${theme.palette.border}`,
                background: wallpaperSrc
                  ? `center / cover no-repeat url("${wallpaperSrc}")`
                  : theme.palette.background,
                boxShadow: "0 6px 16px -8px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}
            >
              {spaceWindows.map((w) => (
                <span
                  key={w.id}
                  style={{
                    position: "absolute",
                    left: `${String(Math.max(0, (w.x / vw) * 100))}%`,
                    top: `${String(Math.max(0, (w.y / vh) * 100))}%`,
                    width: `${String((w.w / vw) * 100)}%`,
                    height: `${String((w.h / vh) * 100)}%`,
                    background: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: 2,
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active ? theme.palette.textPrimary : theme.palette.textSecondary,
              }}
            >
              {`Desktop ${String(i + 1)}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Card({
  win,
  apps,
  theme,
  selected,
  onPick,
}: {
  win: OpenWindow;
  apps: ReturnType<typeof useApps>;
  theme: ReturnType<typeof useTheme>;
  selected: boolean;
  onPick: () => void;
}) {
  const label = labelFor(win, apps);
  const Icon = iconFor(win, apps);
  const scale = Math.min(THUMB_MAX_W / win.w, THUMB_MAX_H / win.h, THUMB_MAX_SCALE);
  const frameW = Math.round(win.w * scale);
  const frameH = Math.round(win.h * scale);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  // Hover, focus, and keyboard selection all show the same neutral highlight.
  const highlight = selected || hovered;

  useEffect(() => {
    // Keep the duplicated preview content out of the tab order and pointer
    // path; it is a thumbnail, not a usable second copy of the app.
    stageRef.current?.setAttribute("inert", "");
  }, []);

  useEffect(() => {
    // Keep the keyboard-selected card in view if the spread scrolls.
    if (selected) frameRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // The card is a div, not a button: the preview renders real app content that
  // can contain its own buttons, and a button cannot nest a button. A
  // transparent overlay button carries the click and keyboard focus.
  return (
    <div
      data-mc-card
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 9,
        width: frameW,
      }}
    >
      <div
        ref={frameRef}
        style={{
          position: "relative",
          width: frameW,
          height: frameH,
          borderRadius: theme.shape.windowRadius,
          border: `1px solid ${highlight ? "rgba(255,255,255,0.5)" : theme.palette.border}`,
          background: theme.palette.surface,
          overflow: "hidden",
          transform: highlight ? "scale(1.03)" : "scale(1)",
          boxShadow: highlight
            ? "0 20px 44px -14px rgba(0,0,0,0.55)"
            : "0 14px 34px -16px rgba(0,0,0,0.5)",
          transition: `transform ${String(theme.motion.dockHoverDurationMs)}ms ease, box-shadow ${String(theme.motion.dockHoverDurationMs)}ms ease, border-color ${String(theme.motion.dockHoverDurationMs)}ms ease`,
        }}
      >
        <div
          ref={stageRef}
          aria-hidden
          style={{
            width: win.w,
            height: win.h,
            transform: `scale(${String(scale)})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <MiniWindow win={win} label={label} apps={apps} theme={theme} />
        </div>
        <button
          type="button"
          onClick={onPick}
          aria-label={label}
          onPointerEnter={() => {
            setHovered(true);
          }}
          onPointerLeave={() => {
            setHovered(false);
          }}
          onFocus={() => {
            setHovered(true);
          }}
          onBlur={() => {
            setHovered(false);
          }}
          style={{
            position: "absolute",
            inset: 0,
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            borderRadius: theme.shape.windowRadius,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          maxWidth: frameW,
          padding: "0 2px",
          color: theme.palette.textPrimary,
        }}
      >
        {Icon ? (
          <span
            style={{
              display: "inline-flex",
              flexShrink: 0,
              color: theme.palette.textSecondary,
            }}
          >
            <Icon size={15} />
          </span>
        ) : null}
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function MiniWindow({
  win,
  label,
  apps,
  theme,
}: {
  win: OpenWindow;
  label: string;
  apps: ReturnType<typeof useApps>;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: theme.palette.surface,
      }}
    >
      <div
        style={{
          height: MINI_TITLE_BAR_H,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          borderBottom: `1px solid ${theme.palette.border}`,
        }}
      >
        <TrafficLights />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.palette.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          // Match the real window body padding so the thumbnail is faithful.
          padding: 16,
          background: theme.palette.background,
          color: theme.palette.textPrimary,
        }}
      >
        <PreviewBoundary
          fallback={
            <PreviewFallback label={label} apps={apps} win={win} theme={theme} />
          }
        >
          <PreviewContent win={win} apps={apps} />
        </PreviewBoundary>
      </div>
    </div>
  );
}

function PreviewContent({
  win,
  apps,
}: {
  win: OpenWindow;
  apps: ReturnType<typeof useApps>;
}): ReactNode {
  const p = win.payload;
  if (p.kind === "app") {
    const app = apps.find((a) => a.id === p.appId);
    if (!app) return null;
    const Content = app.content;
    return <Content appId={app.id} focused={false} />;
  }
  const def = getSystemWindow(p.systemId);
  if (!def) return null;
  const Content = def.content;
  return <Content focused={false} args={p.args} />;
}

function PreviewFallback({
  label,
  apps,
  win,
  theme,
}: {
  label: string;
  apps: ReturnType<typeof useApps>;
  win: OpenWindow;
  theme: ReturnType<typeof useTheme>;
}) {
  const Icon = iconFor(win, apps);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: theme.palette.textSecondary,
      }}
    >
      {Icon ? (
        <Icon size={48} />
      ) : (
        <span style={{ fontSize: 44, fontWeight: 700, opacity: 0.65 }}>
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/**
 * A preview mounts app content a second time. If that content throws on this
 * extra mount, degrade to a neutral fallback rather than taking the whole
 * Mission Control overlay down with it.
 */
class PreviewBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function TrafficLights() {
  const dots = ["#ff5f57", "#febc2e", "#28c840"];
  return (
    <span aria-hidden style={{ display: "inline-flex", gap: 6 }}>
      {dots.map((color) => (
        <span
          key={color}
          style={{ width: 11, height: 11, borderRadius: "50%", background: color }}
        />
      ))}
    </span>
  );
}

function labelFor(win: OpenWindow, apps: ReturnType<typeof useApps>): string {
  const p = win.payload;
  if (p.kind === "app") {
    return apps.find((a) => a.id === p.appId)?.name ?? p.appId;
  }
  const def = getSystemWindow(p.systemId);
  return def ? resolveSystemWindowName(def, p.args) : p.systemId;
}

function iconFor(
  win: OpenWindow,
  apps: ReturnType<typeof useApps>,
): ComponentType<{ size?: number }> | null {
  const p = win.payload;
  if (p.kind === "app") {
    const app = apps.find((a) => a.id === p.appId);
    return app?.icon ?? app?.iconArt ?? null;
  }
  return getSystemWindow(p.systemId)?.desktopIcon ?? null;
}
