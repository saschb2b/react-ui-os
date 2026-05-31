import { describe, expect, it } from "vitest";
import type { OsTheme } from "@react-ui-os/core";
import {
  getChromeMetrics,
  getDockReservation,
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

  it("reserves the left gutter for a left dock (SaaS theme)", () => {
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
