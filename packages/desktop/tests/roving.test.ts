import { describe, expect, it } from "vitest";
import { rovingTarget } from "../src/util/roving";

describe("rovingTarget", () => {
  it("moves with the live axis", () => {
    expect(rovingTarget("ArrowRight", 0, 4, "horizontal")).toBe(1);
    expect(rovingTarget("ArrowLeft", 2, 4, "horizontal")).toBe(1);
    expect(rovingTarget("ArrowDown", 0, 4, "vertical")).toBe(1);
    expect(rovingTarget("ArrowUp", 2, 4, "vertical")).toBe(1);
  });

  it("ignores the cross axis", () => {
    expect(rovingTarget("ArrowDown", 0, 4, "horizontal")).toBe(-1);
    expect(rovingTarget("ArrowUp", 0, 4, "horizontal")).toBe(-1);
    expect(rovingTarget("ArrowRight", 0, 4, "vertical")).toBe(-1);
    expect(rovingTarget("ArrowLeft", 0, 4, "vertical")).toBe(-1);
  });

  it("takes both axes for grids and segmented rows", () => {
    expect(rovingTarget("ArrowRight", 0, 4, "both")).toBe(1);
    expect(rovingTarget("ArrowDown", 0, 4, "both")).toBe(1);
    expect(rovingTarget("ArrowLeft", 1, 4, "both")).toBe(0);
    expect(rovingTarget("ArrowUp", 1, 4, "both")).toBe(0);
  });

  it("wraps around both ends", () => {
    expect(rovingTarget("ArrowRight", 3, 4, "horizontal")).toBe(0);
    expect(rovingTarget("ArrowLeft", 0, 4, "horizontal")).toBe(3);
  });

  it("jumps to the ends for Home and End regardless of orientation", () => {
    expect(rovingTarget("Home", 2, 4, "vertical")).toBe(0);
    expect(rovingTarget("End", 1, 4, "horizontal")).toBe(3);
    expect(rovingTarget("Home", 3, 4, "both")).toBe(0);
  });

  it("returns -1 for a non-navigation key so the event passes through", () => {
    expect(rovingTarget("Enter", 0, 4, "both")).toBe(-1);
    expect(rovingTarget("a", 0, 4, "both")).toBe(-1);
    expect(rovingTarget("Tab", 0, 4, "horizontal")).toBe(-1);
  });

  it("stays put in a single-item group", () => {
    expect(rovingTarget("ArrowRight", 0, 1, "both")).toBe(0);
    expect(rovingTarget("ArrowLeft", 0, 1, "both")).toBe(0);
    expect(rovingTarget("End", 0, 1, "both")).toBe(0);
  });

  it("guards an empty group", () => {
    expect(rovingTarget("ArrowRight", 0, 0, "both")).toBe(-1);
    expect(rovingTarget("Home", 0, 0, "both")).toBe(-1);
  });
});
