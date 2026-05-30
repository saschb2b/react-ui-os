export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp a window's top-left so the title bar stays grabbable inside the work
 * area. Coordinates are viewport-absolute, matching the rest of the window
 * system; the work area's origin (`x` / `y`, below the menu bar and beside the
 * dock) defaults to (0, 0) so callers that only know the size still work.
 */
export function clampWindowToWorkArea(
  x: number,
  y: number,
  w: number,
  h: number,
  workArea: { x?: number; y?: number; width: number; height: number },
  edgeBuffer: number = 24,
): { x: number; y: number } {
  const originX = workArea.x ?? 0;
  const originY = workArea.y ?? 0;
  // Keep at least 64px of the title bar visible horizontally on either side,
  // and the full title bar below the menu bar and above the dock so it stays
  // draggable.
  const minX = originX - w + 64;
  const maxX = originX + workArea.width - 64;
  const minY = originY;
  const maxY = originY + workArea.height - edgeBuffer;
  return {
    x: clamp(x, minX, maxX),
    y: clamp(y, minY, maxY),
  };
}
