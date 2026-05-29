"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AppContentProps } from "@react-ui-os/core";
import { useTheme } from "@react-ui-os/desktop";
import { Toolbar } from "./Toolbar";
import type { CanvasEl } from "./dom-types";
import { useSketchCanvas, type SketchTool } from "./useSketchCanvas";

export function SketchContent({ focused }: AppContentProps) {
  const theme = useTheme();
  const [color, setColor] = useState<string>("#1a1a1a");
  const [size, setSize] = useState<number>(6);
  const [tool, setTool] = useState<SketchTool>("brush");

  const { canvasRef, wrapRef, api } = useSketchCanvas({ color, size, tool });
  const apiRef = useRef(api);
  apiRef.current = api;

  const pointFrom = useCallback(
    (e: ReactPointerEvent<CanvasEl>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [canvasRef],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<CanvasEl>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const p = pointFrom(e);
      if (!p) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      api.start(p);
    },
    [api, pointFrom],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<CanvasEl>) => {
      const p = pointFrom(e);
      if (!p) return;
      api.move(p);
    },
    [api, pointFrom],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<CanvasEl>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      api.end();
    },
    [api],
  );

  // Undo/redo keyboard model matching macOS / Windows: Cmd/Ctrl+Z undo,
  // Cmd/Ctrl+Shift+Z (and Ctrl+Y on Windows) redo. Only while focused.
  useEffect(() => {
    if (!focused || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) apiRef.current.redo();
        else apiRef.current.undo();
      } else if (key === "y") {
        e.preventDefault();
        apiRef.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [focused]);

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    margin: -16,
    background: theme.palette.background,
    color: theme.palette.textPrimary,
  };

  const stageStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    position: "relative",
    margin: 12,
    borderRadius: theme.shape.small,
    border: `1px solid ${theme.palette.border}`,
    overflow: "hidden",
    // Paint surface reads white so dark themes still give a sketch pad
    // to draw on, matching basic paint tools whose canvas is always white.
    background: "#ffffff",
  };

  const canvasStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    touchAction: "none",
    cursor: "crosshair",
  };

  return (
    <div style={rootStyle}>
      <Toolbar
        api={api}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={setSize}
        tool={tool}
        onToolChange={setTool}
      />
      <div ref={wrapRef} style={stageStyle}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Drawing canvas"
          style={canvasStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
