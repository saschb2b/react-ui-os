import { describe, expect, it } from "vitest";
import type { OsTheme } from "@react-ui-os/core";
import {
  getBarThickness,
  getChromeMetrics,
  getDockReservation,
  getDockTileSize,
  getMenuBarHeight,
  getWorkArea,
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

  it("reserves nothing for an auto-hiding bar (it overlays windows)", () => {
    expect(
      getDockReservation(
        themeWith({ dockPosition: "bottom", dockStyle: "bar", dockAutoHide: true }),
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
