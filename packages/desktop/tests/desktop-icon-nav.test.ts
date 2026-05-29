import { describe, expect, it } from "vitest";
import { nextIconIndex } from "../src/util/desktop-icon-nav";

describe("nextIconIndex", () => {
  it("lands on the first icon when ArrowDown is pressed with no selection", () => {
    expect(nextIconIndex(-1, "ArrowDown", 4)).toBe(0);
  });

  it("lands on the last icon when ArrowUp is pressed with no selection", () => {
    expect(nextIconIndex(-1, "ArrowUp", 4)).toBe(3);
  });

  it("moves down and up by one within the column", () => {
    expect(nextIconIndex(1, "ArrowDown", 4)).toBe(2);
    expect(nextIconIndex(2, "ArrowUp", 4)).toBe(1);
  });

  it("clamps at both ends rather than wrapping", () => {
    expect(nextIconIndex(3, "ArrowDown", 4)).toBe(3);
    expect(nextIconIndex(0, "ArrowUp", 4)).toBe(0);
  });

  it("jumps to the first and last icon for Home and End", () => {
    expect(nextIconIndex(2, "Home", 4)).toBe(0);
    expect(nextIconIndex(1, "End", 4)).toBe(3);
  });

  it("stays in range for a single-icon column", () => {
    expect(nextIconIndex(-1, "ArrowDown", 1)).toBe(0);
    expect(nextIconIndex(0, "ArrowDown", 1)).toBe(0);
    expect(nextIconIndex(0, "ArrowUp", 1)).toBe(0);
    expect(nextIconIndex(0, "End", 1)).toBe(0);
  });
});
