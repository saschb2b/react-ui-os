import { describe, expect, it } from "vitest";
import { marqueeFromPoints, marqueeIntersects } from "../src/util/marquee";

describe("marqueeFromPoints", () => {
  it("builds a rectangle from a top-left to bottom-right drag", () => {
    expect(marqueeFromPoints(10, 20, 110, 220)).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 200,
    });
  });

  it("normalizes a drag that goes up and to the left", () => {
    // Dragging from (110, 220) back to (10, 20) is the same rectangle.
    expect(marqueeFromPoints(110, 220, 10, 20)).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 200,
    });
  });

  it("is a zero-size rectangle when the pointer has not moved", () => {
    expect(marqueeFromPoints(50, 50, 50, 50)).toEqual({
      left: 50,
      top: 50,
      width: 0,
      height: 0,
    });
  });
});

describe("marqueeIntersects", () => {
  const rect = { left: 100, top: 100, width: 100, height: 100 }; // 100..200 square

  it("hits a tile fully inside the rectangle", () => {
    expect(
      marqueeIntersects(rect, { left: 120, top: 120, right: 180, bottom: 180 }),
    ).toBe(true);
  });

  it("hits a tile that only partially overlaps", () => {
    expect(
      marqueeIntersects(rect, { left: 180, top: 180, right: 260, bottom: 260 }),
    ).toBe(true);
  });

  it("counts edge contact as a hit", () => {
    // Tile's left edge touches the rectangle's right edge at x=200.
    expect(
      marqueeIntersects(rect, { left: 200, top: 120, right: 260, bottom: 180 }),
    ).toBe(true);
  });

  it("misses a tile to the right", () => {
    expect(
      marqueeIntersects(rect, { left: 220, top: 120, right: 280, bottom: 180 }),
    ).toBe(false);
  });

  it("misses a tile above", () => {
    expect(
      marqueeIntersects(rect, { left: 120, top: 20, right: 180, bottom: 80 }),
    ).toBe(false);
  });
});
