"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas2D, CanvasEl, CanvasImageData } from "./dom-types";

/** Tool a stroke is drawn with. Eraser clears back to transparent. */
export type SketchTool = "brush" | "eraser";

/**
 * Quadratic-curve smoothing: each segment is drawn to the midpoint
 * between the last two sampled points, using the previous point as the
 * control point. This is the standard signature-pad technique for turning
 * a jagged polyline of pointer samples into a smooth curve.
 * https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/quadraticCurveTo
 */
interface Point {
  x: number;
  y: number;
}

/** Bounded so the snapshot history never grows without limit. */
const MAX_HISTORY = 30;

export interface SketchCanvasApi {
  /** Begin a stroke at CSS-pixel coords. */
  start: (p: Point) => void;
  /** Extend the active stroke. */
  move: (p: Point) => void;
  /** End the active stroke and commit a history snapshot. */
  end: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  /** Trigger a PNG download of the current drawing. */
  savePng: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface SketchOptions {
  color: string;
  size: number;
  tool: SketchTool;
}

/**
 * Owns the canvas backing store: devicePixelRatio scaling, a
 * ResizeObserver that preserves the drawing across window resizes, a
 * bounded undo/redo stack, and the freehand stroke math.
 *
 * The hook intentionally reads `color`, `size`, and `tool` through a ref
 * so an in-progress stroke always uses the latest toolbar values without
 * re-binding pointer handlers.
 */
export function useSketchCanvas(opts: SketchOptions) {
  const canvasRef = useRef<CanvasEl | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<Canvas2D | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Active-stroke point buffer. Last two samples drive the quad curve.
  const lastRef = useRef<Point | null>(null);
  const prevRef = useRef<Point | null>(null);
  const drawingRef = useRef(false);

  // Bounded snapshot stacks. Each entry is a full-resolution bitmap.
  const undoStack = useRef<CanvasImageData[]>([]);
  const redoStack = useRef<CanvasImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const snapshot = useCallback((): CanvasImageData | null => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const pushHistory = useCallback(() => {
    const snap = snapshot();
    if (!snap) return;
    undoStack.current.push(snap);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    syncFlags();
  }, [snapshot, syncFlags]);

  const restore = useCallback((img: CanvasImageData) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.putImageData(img, 0, 0);
  }, []);

  /**
   * Size the backing store to css * dpr and scale the context so 1 unit
   * is 1 CSS pixel and strokes stay crisp on HiDPI. Preserve the current
   * drawing by copying the old bitmap onto the resized canvas.
   * https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    const nextW = Math.floor(cssW * dpr);
    const nextH = Math.floor(cssH * dpr);
    if (canvas.width === nextW && canvas.height === nextH) return;

    // Copy current pixels before the backing store is reallocated.
    let prior: CanvasEl | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      prior = document.createElement("canvas");
      prior.width = canvas.width;
      prior.height = canvas.height;
      prior.getContext("2d")?.drawImage(canvas, 0, 0);
    }

    canvas.width = nextW;
    canvas.height = nextH;
    canvas.style.width = `${String(cssW)}px`;
    canvas.style.height = `${String(cssH)}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    if (prior) ctx.drawImage(prior, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Reset the history baseline to the resized bitmap so undo never
    // restores a snapshot at the old resolution.
    const base = snapshot();
    if (base) {
      undoStack.current = [base];
      redoStack.current = [];
      syncFlags();
    }
  }, [snapshot, syncFlags]);

  useEffect(() => {
    resize();
    const wrap = wrapRef.current;
    if (!wrap || typeof window === "undefined" || !window.ResizeObserver) return;
    const ro = new window.ResizeObserver(() => {
      resize();
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
    };
  }, [resize]);

  const drawSegment = useCallback((from: Point, control: Point, to: Point) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { color, size, tool } = optsRef.current;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, mid.x, mid.y);
    ctx.stroke();
  }, []);

  const start = useCallback((p: Point) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawingRef.current = true;
    prevRef.current = p;
    lastRef.current = p;
    // Dot for a tap with no movement, so a single click leaves a mark.
    const { color, size, tool } = optsRef.current;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const move = useCallback(
    (p: Point) => {
      if (!drawingRef.current) return;
      const prev = prevRef.current;
      const last = lastRef.current;
      if (!prev || !last) return;
      drawSegment(prev, last, p);
      prevRef.current = last;
      lastRef.current = p;
    },
    [drawSegment],
  );

  const end = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    prevRef.current = null;
    lastRef.current = null;
    pushHistory();
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (undoStack.current.length <= 1) return;
    const current = undoStack.current.pop();
    if (current) redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    if (prev) restore(prev);
    syncFlags();
  }, [restore, syncFlags]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(next);
    restore(next);
    syncFlags();
  }, [restore, syncFlags]);

  const clear = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pushHistory();
  }, [pushHistory]);

  const savePng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof document === "undefined") return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "sketch.png";
    a.click();
  }, []);

  const api: SketchCanvasApi = {
    start,
    move,
    end,
    undo,
    redo,
    clear,
    savePng,
    canUndo,
    canRedo,
  };

  return { canvasRef, wrapRef, api };
}
