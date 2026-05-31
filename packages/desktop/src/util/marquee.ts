/** A rubber-band selection rectangle in viewport pixels. */
export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Build a normalized rectangle from the drag's start and current points. */
export function marqueeFromPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): MarqueeRect {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

/** Whether a marquee overlaps a tile's bounding box (edge contact counts). */
export function marqueeIntersects(
  rect: MarqueeRect,
  tile: { left: number; top: number; right: number; bottom: number },
): boolean {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  return (
    tile.left <= right &&
    tile.right >= rect.left &&
    tile.top <= bottom &&
    tile.bottom >= rect.top
  );
}
