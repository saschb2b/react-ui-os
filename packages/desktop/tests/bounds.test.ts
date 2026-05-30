import { describe, expect, it } from "vitest";
import type { App, OsTheme, WindowPayload } from "@react-ui-os/core";
import { clamp, clampWindowToWorkArea } from "../src/util/clamp";
import { pickInitialBounds } from "../src/util/initial-bounds";

describe("clamp", () => {
  it("passes values through when already in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("pins to the bounds when out of range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("clampWindowToWorkArea", () => {
  const work = { width: 800, height: 600 };

  it("leaves an on-screen window untouched", () => {
    expect(clampWindowToWorkArea(100, 100, 300, 200, work)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("keeps 64px of the title bar grabbable on the left and right", () => {
    // Far left: at least 64px of a 300px-wide window stays visible, so the
    // minimum x is -(300) + 64.
    expect(clampWindowToWorkArea(-1000, 100, 300, 200, work).x).toBe(-236);
    // Far right: 64px stays inside the work area's right edge.
    expect(clampWindowToWorkArea(1000, 100, 300, 200, work).x).toBe(736);
  });

  it("keeps the title bar below the top edge and above the dock", () => {
    expect(clampWindowToWorkArea(100, -50, 300, 200, work).y).toBe(0);
    // Default 24px edge buffer reserves the dock strip at the bottom.
    expect(clampWindowToWorkArea(100, 1000, 300, 200, work).y).toBe(576);
  });

  it("honors a custom edge buffer", () => {
    expect(
      clampWindowToWorkArea(100, 1000, 300, 200, work, 50).y,
    ).toBe(550);
  });
});

// vitest runs in the node environment, so getWorkArea() (called inside
// pickInitialBounds) takes its documented SSR fallback of 800x600 at origin.
// That makes the placement math deterministic without a DOM: margin 12 gives
// a usable area of 776x576.
const theme = {
  chrome: { menuBar: "top", dockPosition: "bottom" },
} as unknown as OsTheme;

describe("pickInitialBounds", () => {
  it("centers the 720x480 default when nothing else is known", () => {
    const payload: WindowPayload = { kind: "app", appId: "missing" };
    expect(pickInitialBounds(payload, theme, [])).toEqual({
      w: 720,
      h: 480,
      x: 40,
      y: 60,
    });
  });

  it("prefers and centers an app's defaultBounds", () => {
    const apps: App[] = [
      {
        id: "notes",
        name: "Notes",
        defaultBounds: { w: 400, h: 300 },
        content: () => null,
      },
    ];
    const payload: WindowPayload = { kind: "app", appId: "notes" };
    expect(pickInitialBounds(payload, theme, apps)).toEqual({
      w: 400,
      h: 300,
      x: 200,
      y: 150,
    });
  });

  it("uses a registered system window's defaultBounds (Settings is 660x540)", () => {
    const payload: WindowPayload = { kind: "system", systemId: "settings" };
    expect(pickInitialBounds(payload, theme, [])).toEqual({
      w: 660,
      h: 540,
      x: 70,
      y: 30,
    });
  });

  it("honors explicit bounds that fit", () => {
    const payload: WindowPayload = { kind: "app", appId: "notes" };
    expect(
      pickInitialBounds(payload, theme, [], { x: 50, y: 50, w: 300, h: 200 }),
    ).toEqual({ x: 50, y: 50, w: 300, h: 200 });
  });

  it("caps explicit bounds to the work area and clamps the origin inward", () => {
    const payload: WindowPayload = { kind: "app", appId: "notes" };
    // A window larger than the viewport (a docs iframe case) is capped to
    // the usable area and pinned to the top-left margin.
    expect(
      pickInitialBounds(payload, theme, [], {
        x: 0,
        y: 0,
        w: 2000,
        h: 2000,
      }),
    ).toEqual({ x: 12, y: 12, w: 776, h: 576 });
  });

  it("pulls an off-screen explicit origin back inside the margin", () => {
    const payload: WindowPayload = { kind: "app", appId: "notes" };
    expect(
      pickInitialBounds(payload, theme, [], {
        x: -500,
        y: -500,
        w: 300,
        h: 200,
      }),
    ).toEqual({ x: 12, y: 12, w: 300, h: 200 });
  });

  describe("cascade", () => {
    // 400x300 window centers at (200, 150) in the 800x600 node fallback. The
    // cascade step is the regular-mode title-bar height (32px).
    const apps: App[] = [
      {
        id: "notes",
        name: "Notes",
        defaultBounds: { w: 400, h: 300 },
        content: () => null,
      },
    ];
    const payload: WindowPayload = { kind: "app", appId: "notes" };

    it("centers the first window (index 0)", () => {
      expect(pickInitialBounds(payload, theme, apps, undefined, 0)).toMatchObject({
        x: 200,
        y: 150,
      });
    });

    it("steps one title-bar height down and right per index", () => {
      expect(pickInitialBounds(payload, theme, apps, undefined, 1)).toMatchObject({
        x: 232,
        y: 182,
      });
      expect(pickInitialBounds(payload, theme, apps, undefined, 4)).toMatchObject({
        x: 328,
        y: 278,
      });
    });

    it("wraps back to the top, drifted right, when it reaches the bottom", () => {
      // index 5 would land at y=310 (310+300 > the 588 bottom limit), so it
      // resets to the top margin while x keeps the rightward drift.
      expect(pickInitialBounds(payload, theme, apps, undefined, 5)).toMatchObject({
        x: 360,
        y: 12,
      });
    });

    it("wraps a wide window back to the left margin when it reaches the right", () => {
      // A 720-wide window centered at x=40 only has 40px of slack each side, so
      // the first step overflows the right edge and snaps back to the left.
      const wide: App[] = [
        { id: "wide", name: "Wide", defaultBounds: { w: 720, h: 480 }, content: () => null },
      ];
      expect(
        pickInitialBounds({ kind: "app", appId: "wide" }, theme, wide, undefined, 1),
      ).toMatchObject({ x: 12, y: 92 });
    });

    it("never places a cascaded window off-screen", () => {
      const work = { x: 0, y: 0, width: 800, height: 600 };
      for (let i = 0; i < 60; i++) {
        const b = pickInitialBounds(payload, theme, apps, undefined, i);
        expect(b.x).toBeGreaterThanOrEqual(work.x);
        expect(b.y).toBeGreaterThanOrEqual(work.y);
        expect(b.x + b.w).toBeLessThanOrEqual(work.x + work.width);
        expect(b.y + b.h).toBeLessThanOrEqual(work.y + work.height);
      }
    });
  });
});
