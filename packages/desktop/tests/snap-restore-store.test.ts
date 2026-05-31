import { afterEach, describe, expect, it } from "vitest";
import {
  clearSnapRestore,
  peekSnapRestore,
  recordSnapRestore,
} from "../src/snap/snap-restore-store";

afterEach(() => {
  clearSnapRestore("app:notes");
  clearSnapRestore("app:other");
});

describe("snap restore store", () => {
  it("returns undefined for a window that was never snapped", () => {
    expect(peekSnapRestore("app:notes")).toBeUndefined();
  });

  it("remembers the pre-snap size and reads it back without clearing", () => {
    recordSnapRestore("app:notes", { w: 680, h: 460 });
    expect(peekSnapRestore("app:notes")).toEqual({ w: 680, h: 460 });
    // peek does not consume it
    expect(peekSnapRestore("app:notes")).toEqual({ w: 680, h: 460 });
  });

  it("keeps the first size when a window is snapped again", () => {
    recordSnapRestore("app:notes", { w: 680, h: 460 });
    // A re-snap (now from a 640x686 half) must not overwrite the original.
    recordSnapRestore("app:notes", { w: 640, h: 686 });
    expect(peekSnapRestore("app:notes")).toEqual({ w: 680, h: 460 });
  });

  it("forgets the size once cleared, so a record can be taken again", () => {
    recordSnapRestore("app:notes", { w: 680, h: 460 });
    clearSnapRestore("app:notes");
    expect(peekSnapRestore("app:notes")).toBeUndefined();
    recordSnapRestore("app:notes", { w: 500, h: 400 });
    expect(peekSnapRestore("app:notes")).toEqual({ w: 500, h: 400 });
  });

  it("keeps each window's size separate", () => {
    recordSnapRestore("app:notes", { w: 680, h: 460 });
    recordSnapRestore("app:other", { w: 300, h: 200 });
    expect(peekSnapRestore("app:notes")).toEqual({ w: 680, h: 460 });
    expect(peekSnapRestore("app:other")).toEqual({ w: 300, h: 200 });
  });
});
