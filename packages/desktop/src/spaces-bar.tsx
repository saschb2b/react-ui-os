"use client";

import type { OpenWindow, OsTheme } from "@react-ui-os/core";

/**
 * Workspace thumbnail strip: a live miniature of each workspace (wallpaper
 * plus window outlines) that switches on click and offers an "Add" tile, the
 * GNOME / macOS overview row. Shared by Mission Control and the GNOME app-grid
 * overview so both show the same spaces.
 */
export function SpacesBar({
  workspaces,
  activeId,
  onSwitch,
  onAdd,
  windows,
  wallpaperSrc,
  theme,
}: {
  workspaces: string[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  windows: OpenWindow[];
  wallpaperSrc: string | undefined;
  theme: OsTheme;
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
                  ? `2px solid ${theme.palette.textPrimary}`
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
                    background: theme.palette.border,
                    border: `1px solid ${theme.palette.textSecondary}`,
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
      <button
        type="button"
        data-mc-space
        aria-label="Add a space"
        onClick={() => {
          onAdd();
        }}
        onPointerEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.opacity = "0.5";
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
          opacity: 0.5,
          transition: `opacity ${String(theme.motion.dockHoverDurationMs)}ms ease`,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "grid",
            placeItems: "center",
            width: 124,
            height: 74,
            borderRadius: theme.shape.small,
            border: `1px dashed ${theme.palette.border}`,
            color: theme.palette.textSecondary,
            fontSize: 28,
            fontWeight: 300,
            lineHeight: 1,
          }}
        >
          +
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: theme.palette.textSecondary,
          }}
        >
          Add
        </span>
      </button>
    </div>
  );
}
