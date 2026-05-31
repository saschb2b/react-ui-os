/**
 * Per-window memory of the size a window had before it was snapped to a zone,
 * so dragging it back off restores that size (Windows). Both snap paths write
 * here: the drag-snap commit in <Window> and the keyboard snap in
 * keyboard-shortcuts. <Window> reads it imperatively when a drag begins, so
 * unlike the snap-preview store there is no subscription to drive a render.
 *
 * Window ids are stable and reused (`app:notes` survives close + reopen), so
 * the record is cleared on tear-off, on a manual resize, and on close.
 */

interface SnapRestoreSize {
  w: number;
  h: number;
}

const sizes = new Map<string, SnapRestoreSize>();

/**
 * Remember the pre-snap size, but only the first time, so re-snapping a window
 * from one zone to another keeps the size it had before any of them.
 */
export function recordSnapRestore(id: string, size: SnapRestoreSize): void {
  if (!sizes.has(id)) sizes.set(id, size);
}

/** The pre-snap size for a window, or undefined when it is not snapped. */
export function peekSnapRestore(id: string): SnapRestoreSize | undefined {
  return sizes.get(id);
}

export function clearSnapRestore(id: string): void {
  sizes.delete(id);
}
