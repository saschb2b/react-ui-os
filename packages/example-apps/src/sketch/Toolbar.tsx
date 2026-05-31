"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Slider, useTheme } from "@react-ui-os/desktop";
import {
  BrushIcon,
  DownloadIcon,
  EraserIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from "./tool-icons";
import type { SketchCanvasApi, SketchTool } from "./useSketchCanvas";

/**
 * Drawing palette. These hex values are CONTENT (the colors the user
 * paints with), not chrome, so concrete values are allowed here per the
 * house rules. Set follows a basic paint default: black plus a small
 * primary/secondary spread.
 */
const SWATCHES = [
  "#1a1a1a",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
] as const;

/** A few brush sizes mirroring the discrete thickness picker in basic paint tools. */
const MIN_SIZE = 1;
const MAX_SIZE = 48;

interface ToolbarProps {
  api: SketchCanvasApi;
  color: string;
  onColorChange: (next: string) => void;
  size: number;
  onSizeChange: (next: number) => void;
  tool: SketchTool;
  onToolChange: (next: SketchTool) => void;
}

export function Toolbar({
  api,
  color,
  onColorChange,
  size,
  onSizeChange,
  tool,
  onToolChange,
}: ToolbarProps) {
  const theme = useTheme();
  const accent = theme.palette.accent;
  const customId = useId();
  const [customColor, setCustomColor] = useState("#a855f7");

  const barStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: "8px 10px",
    background: theme.palette.surface,
    borderBottom: `1px solid ${theme.palette.border}`,
    color: theme.palette.textPrimary,
  };

  const groupStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const dividerStyle: CSSProperties = {
    width: 1,
    alignSelf: "stretch",
    background: theme.palette.border,
  };

  const transition = `transform ${String(theme.motion.dockHoverDurationMs)}ms ${theme.motion.windowOpenEasing}, box-shadow ${String(theme.motion.dockHoverDurationMs)}ms ${theme.motion.windowOpenEasing}`;

  function iconButton(
    label: string,
    icon: ReactNode,
    onClick: () => void,
    opts?: { active?: boolean; disabled?: boolean },
  ) {
    const active = opts?.active ?? false;
    const disabled = opts?.disabled ?? false;
    const btnStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      borderRadius: theme.shape.small,
      border: `1px solid ${active ? accent : theme.palette.border}`,
      background: active ? `${accent}22` : "transparent",
      color: active ? accent : theme.palette.textPrimary,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      padding: 0,
      transition,
    };
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={opts?.active}
        disabled={disabled}
        onClick={onClick}
        style={btnStyle}
        className="rui-sketch-btn"
      >
        {icon}
      </button>
    );
  }

  return (
    <div style={barStyle} role="toolbar" aria-label="Sketch tools">
      <div style={groupStyle} role="group" aria-label="Brush color">
        {SWATCHES.map((hex) => {
          const selected = tool === "brush" && color.toLowerCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              aria-label={`Color ${hex}`}
              aria-pressed={selected}
              onClick={() => {
                onColorChange(hex);
                onToolChange("brush");
              }}
              className="rui-sketch-btn"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: hex,
                // The selection ring is an accent affordance, not garnish.
                border: selected
                  ? `2px solid ${accent}`
                  : `1px solid ${theme.palette.border}`,
                boxShadow: selected
                  ? `0 0 0 2px ${theme.palette.surface}, 0 0 0 3px ${accent}`
                  : "none",
                cursor: "pointer",
                padding: 0,
                transition,
              }}
            />
          );
        })}
        <label
          htmlFor={customId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            border:
              tool === "brush" && color.toLowerCase() === customColor.toLowerCase()
                ? `2px solid ${accent}`
                : `1px solid ${theme.palette.border}`,
            background: customColor,
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
          title="Custom color"
        >
          <input
            id={customId}
            type="color"
            aria-label="Custom brush color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              onColorChange(e.target.value);
              onToolChange("brush");
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          />
        </label>
      </div>

      <span style={dividerStyle} aria-hidden />

      <div
        style={{ ...groupStyle, minWidth: 132 }}
        role="group"
        aria-label="Brush size"
      >
        {iconButton(
          "Brush",
          <BrushIcon />,
          () => {
            onToolChange("brush");
          },
          { active: tool === "brush" },
        )}
        <div style={{ flex: 1, minWidth: 88 }}>
          <Slider
            value={size}
            min={MIN_SIZE}
            max={MAX_SIZE}
            onChange={onSizeChange}
            ariaLabel="Brush size"
            unit="px"
            accent={accent}
          />
        </div>
      </div>

      <span style={dividerStyle} aria-hidden />

      <div style={groupStyle} role="group" aria-label="Actions">
        {iconButton(
          "Eraser",
          <EraserIcon />,
          () => {
            onToolChange("eraser");
          },
          { active: tool === "eraser" },
        )}
        {iconButton("Undo", <UndoIcon />, api.undo, { disabled: !api.canUndo })}
        {iconButton("Redo", <RedoIcon />, api.redo, { disabled: !api.canRedo })}
        {iconButton("Clear", <TrashIcon />, api.clear)}
        {iconButton("Save as PNG", <DownloadIcon />, api.savePng)}
      </div>

      <style>
        {`
          .rui-sketch-btn:focus-visible {
            outline: 2px solid ${accent};
            outline-offset: 2px;
          }
          .rui-sketch-btn:not(:disabled):hover {
            transform: translateY(-1px);
          }
        `}
      </style>
    </div>
  );
}
