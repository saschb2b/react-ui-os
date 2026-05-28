export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Clamp a window's top-left so the title bar stays grabbable inside the work area. */
export function clampWindowToWorkArea(
  x: number,
  y: number,
  w: number,
  h: number,
  workArea: { width: number; height: number },
  edgeBuffer: number = 24,
): { x: number; y: number } {
  // Keep at least 64px of the title bar visible horizontally on either side,
  // and the full title bar above the dock so it stays draggable.
  const minX = -w + 64;
  const maxX = workArea.width - 64;
  const minY = 0;
  const maxY = workArea.height - edgeBuffer;
  return {
    x: clamp(x, minX, maxX),
    y: clamp(y, minY, maxY),
  };
}
