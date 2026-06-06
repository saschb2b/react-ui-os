// Index math for a roving-tabindex group (a settings category list, a segmented
// control, a swatch or wallpaper grid). Given the pressed key and the current
// index, returns the index to focus next, or -1 when the key isn't a navigation
// key so the caller can let the event through. `orientation` selects which
// arrows are live: a single-axis list takes one pair, a grid or segmented row
// takes both. Movement wraps; Home/End jump to the ends.
export function rovingTarget(
  key: string,
  index: number,
  count: number,
  orientation: "horizontal" | "vertical" | "both",
): number {
  if (count <= 0) return -1;
  const forward =
    (orientation !== "vertical" && key === "ArrowRight") ||
    (orientation !== "horizontal" && key === "ArrowDown");
  const back =
    (orientation !== "vertical" && key === "ArrowLeft") ||
    (orientation !== "horizontal" && key === "ArrowUp");
  if (forward) return (index + 1) % count;
  if (back) return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return -1;
}
