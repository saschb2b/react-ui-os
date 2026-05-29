import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewportMode } from "../src/util/viewport-mode";

// getViewportMode reads window.innerWidth/innerHeight; stub a minimal window
// so the 800x540 breakpoint can be checked without a real viewport.
function stubViewport(innerWidth: number, innerHeight: number): void {
  vi.stubGlobal("window", { innerWidth, innerHeight });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getViewportMode", () => {
  it("falls back to regular when there is no window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(getViewportMode()).toBe("regular");
  });

  it("is regular on a desktop-class viewport", () => {
    stubViewport(1440, 900);
    expect(getViewportMode()).toBe("regular");
  });

  it("is compact when narrower than 800px", () => {
    stubViewport(700, 900);
    expect(getViewportMode()).toBe("compact");
  });

  it("is compact when shorter than 540px", () => {
    stubViewport(1440, 500);
    expect(getViewportMode()).toBe("compact");
  });

  it("treats the 800x540 threshold itself as regular (strict less-than)", () => {
    stubViewport(800, 540);
    expect(getViewportMode()).toBe("regular");
  });

  it("flips to compact one pixel inside either threshold", () => {
    stubViewport(799, 540);
    expect(getViewportMode()).toBe("compact");
    vi.unstubAllGlobals();
    stubViewport(800, 539);
    expect(getViewportMode()).toBe("compact");
  });
});
