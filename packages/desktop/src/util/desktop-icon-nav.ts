import { clamp } from "./clamp";

export type IconNavKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/**
 * Next selected index for the desktop-icon column given an arrow/Home/End
 * key. `current` is -1 when nothing is selected yet: ArrowDown then lands on
 * the first icon and ArrowUp on the last, matching macOS list navigation.
 * Movement clamps at both ends (no wrap). The caller guarantees count > 0.
 */
export function nextIconIndex(current: number, key: IconNavKey, count: number): number {
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : clamp(current + 1, 0, count - 1);
    case "ArrowUp":
      return current < 0 ? count - 1 : clamp(current - 1, 0, count - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}
