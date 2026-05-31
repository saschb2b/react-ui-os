import { describe, expect, it } from "vitest";
import { computeSnapZone, rectForZone } from "../src/snap/snap-store";
import type { WorkArea } from "../src/util/layout";

// Offset work area (x>0, y>0) so the tests prove the zone math respects the
// work-area origin rather than assuming the viewport starts at 0,0. The menu
// bar pushes y down and a left dock would push x right, so this is the real
// shape computeSnapZone sees. Thresholds in the store: EDGE = 24, CORNER = 48.
const WORK: WorkArea = { x: 100, y: 24, width: 1000, height: 600 };

describe("computeSnapZone", () => {
  it("returns null in the dead center", () => {
    expect(computeSnapZone(600, 324, WORK)).toBeNull();
  });

  it("maps the top edge (away from corners) to maximize", () => {
    expect(computeSnapZone(600, WORK.y + 10, WORK)).toBe("top-max");
  });

  it("maps the left and right edges to halves", () => {
    expect(computeSnapZone(WORK.x + 10, 324, WORK)).toBe("left-half");
    expect(computeSnapZone(WORK.x + WORK.width - 10, 324, WORK)).toBe("right-half");
  });

  it("maps the four corners to quarters", () => {
    expect(computeSnapZone(WORK.x + 10, WORK.y + 10, WORK)).toBe("top-left-quarter");
    expect(computeSnapZone(WORK.x + WORK.width - 10, WORK.y + 10, WORK)).toBe(
      "top-right-quarter",
    );
    expect(computeSnapZone(WORK.x + 10, WORK.y + WORK.height - 10, WORK)).toBe(
      "bottom-left-quarter",
    );
    expect(
      computeSnapZone(WORK.x + WORK.width - 10, WORK.y + WORK.height - 10, WORK),
    ).toBe("bottom-right-quarter");
  });

  it("corner takes precedence over edge when the pointer hugs a corner", () => {
    // Top edge AND within the corner band: the quarter wins, not top-max.
    expect(computeSnapZone(WORK.x + 30, WORK.y + 5, WORK)).toBe("top-left-quarter");
  });

  it("leaves the bottom-center edge unsnapped (no maximize-from-bottom)", () => {
    expect(computeSnapZone(600, WORK.y + WORK.height - 5, WORK)).toBeNull();
  });

  it("respects the activation thresholds at their boundary", () => {
    // Exactly EDGE_THRESHOLD past the top is still inside (<=).
    expect(computeSnapZone(600, WORK.y + 24, WORK)).toBe("top-max");
    // One pixel further in is no longer a zone.
    expect(computeSnapZone(600, WORK.y + 25, WORK)).toBeNull();
  });
});

describe("rectForZone", () => {
  const halfW = 500;
  const halfH = 300;

  it("fills the whole work area for top-max", () => {
    expect(rectForZone("top-max", WORK)).toEqual({
      x: 100,
      y: 24,
      w: 1000,
      h: 600,
    });
  });

  it("splits the work area into left and right halves", () => {
    expect(rectForZone("left-half", WORK)).toEqual({
      x: 100,
      y: 24,
      w: halfW,
      h: 600,
    });
    expect(rectForZone("right-half", WORK)).toEqual({
      x: 100 + 1000 - halfW,
      y: 24,
      w: halfW,
      h: 600,
    });
  });

  it("places the four quarters in their corners", () => {
    expect(rectForZone("top-left-quarter", WORK)).toEqual({
      x: 100,
      y: 24,
      w: halfW,
      h: halfH,
    });
    expect(rectForZone("top-right-quarter", WORK)).toEqual({
      x: 600,
      y: 24,
      w: halfW,
      h: halfH,
    });
    expect(rectForZone("bottom-left-quarter", WORK)).toEqual({
      x: 100,
      y: 24 + 600 - halfH,
      w: halfW,
      h: halfH,
    });
    expect(rectForZone("bottom-right-quarter", WORK)).toEqual({
      x: 600,
      y: 24 + 600 - halfH,
      w: halfW,
      h: halfH,
    });
  });

  it("floors the half so an odd-width work area leaves no sub-pixel seam", () => {
    const odd: WorkArea = { x: 0, y: 0, width: 999, height: 600 };
    const left = rectForZone("left-half", odd);
    const right = rectForZone("right-half", odd);
    expect(left.w).toBe(499);
    expect(right.w).toBe(499);
    // Right edge stays flush with the work-area edge; the seam is the gap.
    expect(right.x + right.w).toBe(999);
  });
});
