"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useTheme } from "./desktop-context";
import { QUICK_SETTINGS_TOGGLE_EVENT } from "./events";
import { Slider } from "./primitives";
import { Tooltip } from "./tooltip";
import { getChromeMetrics } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";
import { useReducedMotion } from "./util/use-reduced-motion";
import {
  listQuickSettings,
  subscribeQuickSettings,
  type QuickSettingAction,
  type QuickSettingSlider,
  type QuickSettingToggle,
} from "./quick-settings";

/**
 * The popover that drops from the menu-bar status cluster: the GNOME system
 * menu, the macOS Control Center, the Windows quick settings flyout. Renders
 * the entries registered via `registerQuickSetting` grouped by kind, action
 * buttons in a header row, sliders, then a two-column grid of toggle tiles.
 * Toggled by `QUICK_SETTINGS_TOGGLE_EVENT`, dismissed by Escape or by clicking
 * away. Renders nothing until something is registered.
 *
 * Mounted once by `<Desktop>`. The panel anchors under the top menu bar when
 * the theme uses one, otherwise to the top-right corner.
 */
export function QuickSettings() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const items = useSyncExternalStore(
    subscribeQuickSettings,
    listQuickSettings,
    listQuickSettings,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    window.addEventListener(QUICK_SETTINGS_TOGGLE_EVENT, handleToggle);
    return () => {
      window.removeEventListener(QUICK_SETTINGS_TOGGLE_EVENT, handleToggle);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const actions = items.filter((i): i is QuickSettingAction => i.kind === "action");
  const sliders = items.filter((i): i is QuickSettingSlider => i.kind === "slider");
  const toggles = items.filter((i): i is QuickSettingToggle => i.kind === "toggle");
  const startActions = actions.filter((a) => a.align !== "end");
  const endActions = actions.filter((a) => a.align === "end");

  const topGutter = theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0;

  const backdrop: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 1300,
    pointerEvents: open ? "auto" : "none",
  };

  const panel: CSSProperties = {
    position: "fixed",
    top: topGutter + 6,
    right: 8,
    width: 336,
    maxWidth: "calc(100vw - 16px)",
    background: theme.palette.surface,
    backdropFilter: theme.blur.surface,
    WebkitBackdropFilter: theme.blur.surface,
    border: `1px solid ${theme.palette.border}`,
    // A popover is a window-like surface; share the window corner family.
    borderRadius: theme.shape.windowRadius,
    color: theme.palette.textPrimary,
    boxShadow: theme.elevation?.windowFocused ?? "0 16px 40px -12px rgba(0,0,0,0.5)",
    zIndex: 1310,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    fontFamily: "inherit",
    transformOrigin: "top right",
    opacity: open ? 1 : 0,
    transform: open ? "scale(1)" : "scale(0.96)",
    pointerEvents: open ? "auto" : "none",
    visibility: open ? "visible" : "hidden",
    // Under reduced motion the popover appears without the scale/fade.
    transition: reducedMotion
      ? "none"
      : `opacity ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}, transform ${String(theme.motion.windowOpenDurationMs)}ms ${theme.motion.windowOpenEasing}`,
  };

  return (
    <>
      <div style={backdrop} aria-hidden={!open} onClick={() => setOpen(false)} />
      <div style={panel} role="dialog" aria-label="Quick settings" aria-hidden={!open}>
        {actions.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {startActions.map((a) => (
                <ActionButton key={a.id} item={a} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {endActions.map((a) => (
                <ActionButton key={a.id} item={a} />
              ))}
            </div>
          </div>
        )}

        {sliders.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sliders.map((s) => (
              <SliderRow key={s.id} item={s} />
            ))}
          </div>
        )}

        {toggles.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {toggles.map((t) => (
              <ToggleTile key={t.id} item={t} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ActionButton({ item }: { item: QuickSettingAction }) {
  const theme = useTheme();
  const idle = `${theme.palette.textPrimary}14`;
  const hover = `${theme.palette.textPrimary}26`;
  const button = (
    <button
      type="button"
      onClick={item.onClick}
      aria-label={item.tooltip ?? item.id}
      style={{
        appearance: "none",
        border: 0,
        width: 34,
        height: 34,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        background: idle,
        color: theme.palette.textPrimary,
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = idle;
      }}
    >
      {item.icon}
    </button>
  );
  if (!item.tooltip) return button;
  return (
    <Tooltip text={item.tooltip} placement="bottom">
      {button}
    </Tooltip>
  );
}

function SliderRow({ item }: { item: QuickSettingSlider }) {
  const theme = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {item.icon && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            color: theme.palette.textSecondary,
            flexShrink: 0,
          }}
        >
          {item.icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Slider
          value={Math.round(item.value * 100)}
          min={0}
          max={100}
          onChange={(v) => item.onChange?.(v / 100)}
          ariaLabel={item.ariaLabel}
          hideValue
        />
      </div>
    </div>
  );
}

function ToggleTile({ item }: { item: QuickSettingToggle }) {
  const theme = useTheme();
  const active = item.active ?? false;
  const inactiveBg = `${theme.palette.textPrimary}14`;
  const fg = active ? "#fff" : theme.palette.textPrimary;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        // The toggle tile is a tile, so it shares the dock-tile corner family.
        borderRadius: theme.shape.dockTileRadius,
        background: active ? theme.palette.accent : inactiveBg,
        overflow: "hidden",
        transition: `background ${String(theme.motion.dockHoverDurationMs)}ms ease`,
      }}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={item.label}
        onClick={() => item.onToggle?.(!active)}
        style={{
          appearance: "none",
          border: 0,
          background: "transparent",
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          cursor: "pointer",
          color: fg,
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        {item.icon && (
          <span aria-hidden style={{ display: "inline-flex", flexShrink: 0 }}>
            {item.icon}
          </span>
        )}
        <span style={{ minWidth: 0, lineHeight: 1.2 }}>
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </span>
          {item.sublabel && (
            <span
              style={{
                display: "block",
                fontSize: 11,
                opacity: 0.8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.sublabel}
            </span>
          )}
        </span>
      </button>
      {item.onExpand && (
        <button
          type="button"
          aria-label={`${item.label} details`}
          onClick={item.onExpand}
          style={{
            appearance: "none",
            border: 0,
            background: "transparent",
            alignSelf: "stretch",
            display: "flex",
            alignItems: "center",
            paddingRight: 10,
            paddingLeft: 4,
            cursor: "pointer",
            color: fg,
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
          >
            <path d="M4.5 2.5 L8 6 L4.5 9.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
