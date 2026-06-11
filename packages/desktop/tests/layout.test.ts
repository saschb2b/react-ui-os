import { describe, expect, it } from "vitest";
import type { OsTheme } from "@react-ui-os/core";
import {
  getBarThickness,
  getChromeMetrics,
  getDockIconScale,
  getDockReservation,
  getDockTileSize,
  getMenuBarHeight,
  getWorkArea,
  shouldShrinkWhenFull,
} from "../src/util/layout";

function themeWith(chrome: Partial<OsTheme["chrome"]>): OsTheme {
  return { chrome } as unknown as OsTheme;
}

describe("getChromeMetrics", () => {
  it("derives the bottom-dock and left-dock footprints from tile + padding", () => {
    const regular = getChromeMetrics("regular");
    expect(regular.dockHeight).toBe(regular.dockTileSize + regular.dockPadding * 2);
    expect(regular.dockWidth).toBe(regular.dockTileSize + regular.dockPadding * 2);
  });

  it("uses tighter chrome in compact mode", () => {
    const regular = getChromeMetrics("regular");
    const compact = getChromeMetrics("compact");
    expect(compact.dockTileSize).toBeLessThan(regular.dockTileSize);
    expect(compact.menuBarHeight).toBeLessThan(regular.menuBarHeight);
    expect(compact.titleBarHeight).toBeLessThan(regular.titleBarHeight);
  });

  it("matches the macOS Big Sur+ 24pt menu bar at regular size", () => {
    expect(getChromeMetrics("regular").menuBarHeight).toBe(24);
  });
});

describe("getMenuBarHeight", () => {
  it("reserves the menu-bar strip when the bar is shown", () => {
    expect(getMenuBarHeight(themeWith({ menuBar: "top" }))).toBe(24);
  });

  it("reserves nothing when the menu bar is hidden", () => {
    expect(getMenuBarHeight(themeWith({ menuBar: "none" }))).toBe(0);
  });

  it("honors a theme's menuBarHeight token (the GNOME top bar)", () => {
    expect(getMenuBarHeight(themeWith({ menuBar: "top", menuBarHeight: 30 }))).toBe(30);
  });
});

describe("getDockTileSize", () => {
  it("falls back to the bar tile metric for a bar dock without a token", () => {
    const m = getChromeMetrics("regular");
    expect(getDockTileSize(themeWith({ dockStyle: "bar" }), "regular")).toBe(
      m.taskbarTileSize,
    );
  });

  it("falls back to the floating tile metric for a floating dock", () => {
    const m = getChromeMetrics("regular");
    expect(getDockTileSize(themeWith({ dockStyle: "floating" }), "regular")).toBe(
      m.dockTileSize,
    );
  });

  it("uses the theme's dockTileSize token when set", () => {
    expect(
      getDockTileSize(themeWith({ dockStyle: "bar", dockTileSize: 40 }), "regular"),
    ).toBe(40);
  });

  it("shrinks a token-set tile in compact mode", () => {
    const regular = getDockTileSize(themeWith({ dockTileSize: 56 }), "regular");
    const compact = getDockTileSize(themeWith({ dockTileSize: 56 }), "compact");
    expect(compact).toBeLessThan(regular);
  });
});

describe("small taskbar buttons", () => {
  const small = themeWith({
    dockStyle: "bar",
    dockTileSize: 40,
    dockSmallButtons: "always",
  });

  it("drops the Windows button from 40 to 24px when always-small", () => {
    expect(getDockTileSize(small, "regular")).toBe(24);
  });

  it("drops the Windows bar from 48 to 32px when always-small", () => {
    expect(getBarThickness(small, "regular")).toBe(32);
  });

  it("keeps full size for when-full and never (the bar decides live)", () => {
    for (const mode of ["when-full", "never"] as const) {
      const t = themeWith({
        dockStyle: "bar",
        dockTileSize: 40,
        dockSmallButtons: mode,
      });
      expect(getDockTileSize(t, "regular")).toBe(40);
      expect(getBarThickness(t, "regular")).toBe(48);
    }
  });

  it("ignores the setting on a floating dock", () => {
    const t = themeWith({
      dockStyle: "floating",
      dockTileSize: 56,
      dockSmallButtons: "always",
    });
    expect(getDockTileSize(t, "regular")).toBe(56);
  });

  it("compensates the icon scale so 24px buttons carry 16px icons", () => {
    const t = themeWith({ dockIconScale: 0.6 });
    // 24 * 0.6667 = 16, the Windows small-taskbar icon size.
    expect(Math.round(24 * getDockIconScale(t, true))).toBe(16);
    expect(getDockIconScale(t, false)).toBe(0.6);
  });

  it("shrinks when the full-size run would overflow, not before", () => {
    const fits = { count: 10, tile: 40, gap: 4, fixed: 200, available: 1280 };
    expect(shouldShrinkWhenFull(fits)).toBe(false);
    expect(shouldShrinkWhenFull({ ...fits, count: 30 })).toBe(true);
  });
});

describe("getBarThickness", () => {
  it("keeps the viewport metric for a bar without a tile token", () => {
    const m = getChromeMetrics("regular");
    expect(getBarThickness(themeWith({ dockStyle: "bar" }), "regular")).toBe(
      m.taskbarSize,
    );
  });

  it("derives from the tile when a token is set (Windows 40 -> 48 bar)", () => {
    expect(
      getBarThickness(themeWith({ dockStyle: "bar", dockTileSize: 40 }), "regular"),
    ).toBe(48);
  });

  it("makes a larger-icon dock a wider bar (Ubuntu 56 -> 64)", () => {
    expect(
      getBarThickness(themeWith({ dockStyle: "bar", dockTileSize: 56 }), "regular"),
    ).toBe(64);
  });
});

describe("getDockReservation", () => {
  it("reserves the bottom strip for a bottom dock", () => {
    const r = getDockReservation(themeWith({ dockPosition: "bottom" }));
    const m = getChromeMetrics("regular");
    expect(r).toEqual({
      top: 0,
      right: 0,
      bottom: m.dockHeight + m.dockEdgeOffset,
      left: 0,
    });
  });

  it("reserves the left gutter for a left dock", () => {
    const r = getDockReservation(themeWith({ dockPosition: "left" }));
    const m = getChromeMetrics("regular");
    expect(r).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: m.dockWidth + m.dockEdgeOffset * 2,
    });
  });

  it("reserves the top strip for a top dock", () => {
    const r = getDockReservation(themeWith({ dockPosition: "top" }));
    const m = getChromeMetrics("regular");
    expect(r).toEqual({
      top: m.dockHeight + m.dockEdgeOffset,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("reserves the right gutter for a right dock", () => {
    const r = getDockReservation(themeWith({ dockPosition: "right" }));
    const m = getChromeMetrics("regular");
    expect(r).toEqual({
      top: 0,
      right: m.dockWidth + m.dockEdgeOffset * 2,
      bottom: 0,
      left: 0,
    });
  });

  it("reserves nothing for a hidden dock", () => {
    expect(getDockReservation(themeWith({ dockPosition: "hidden" }))).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("derives a bottom bar's strip from its tile token", () => {
    const r = getDockReservation(
      themeWith({ dockPosition: "bottom", dockStyle: "bar", dockTileSize: 56 }),
    );
    expect(r.bottom).toBe(64);
  });

  it("derives a left bar's gutter from its tile token", () => {
    const r = getDockReservation(
      themeWith({ dockPosition: "left", dockStyle: "bar", dockTileSize: 56 }),
    );
    expect(r.left).toBe(64);
  });

  it("derives a top bar's strip from its tile token (movable Windows taskbar)", () => {
    const r = getDockReservation(
      themeWith({ dockPosition: "top", dockStyle: "bar", dockTileSize: 40 }),
    );
    expect(r).toEqual({ top: 48, right: 0, bottom: 0, left: 0 });
  });

  it("derives a right bar's gutter from its tile token", () => {
    const r = getDockReservation(
      themeWith({ dockPosition: "right", dockStyle: "bar", dockTileSize: 40 }),
    );
    expect(r).toEqual({ top: 0, right: 48, bottom: 0, left: 0 });
  });

  it("reserves nothing for an auto-hiding bar (it overlays windows)", () => {
    expect(
      getDockReservation(
        themeWith({ dockPosition: "bottom", dockStyle: "bar", dockAutoHide: true }),
      ),
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(
      getDockReservation(
        themeWith({ dockPosition: "top", dockStyle: "bar", dockAutoHide: true }),
      ),
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe("getWorkArea", () => {
  it("falls back to a fixed 800x600 area under SSR (no window)", () => {
    // The node test environment has no window, exercising the documented
    // SSR fallback rather than reading innerWidth/innerHeight.
    expect(getWorkArea(themeWith({ menuBar: "top", dockPosition: "bottom" }))).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });
});
