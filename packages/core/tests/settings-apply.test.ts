import { describe, expect, it } from "vitest";
import { applyPrefs, getPath, setPath } from "../src/settings/apply";
import type { OsTheme } from "../src/types";

describe("getPath", () => {
  it("reads nested values", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getPath(obj, "a.b.c")).toBe(42);
  });

  it("returns undefined for missing paths", () => {
    expect(getPath({ a: 1 }, "a.b")).toBeUndefined();
    expect(getPath({}, "x.y.z")).toBeUndefined();
  });

  it("returns the input for empty path", () => {
    const obj = { a: 1 };
    expect(getPath(obj, "")).toBe(obj);
  });
});

describe("setPath", () => {
  it("writes a leaf value without mutating input", () => {
    const obj = { a: { b: 1 } };
    const next = setPath(obj, "a.b", 2);
    expect(next).toEqual({ a: { b: 2 } });
    expect(obj).toEqual({ a: { b: 1 } });
  });

  it("creates intermediate objects when missing", () => {
    expect(setPath({}, "a.b.c", 4)).toEqual({ a: { b: { c: 4 } } });
  });

  it("merges siblings at the leaf level", () => {
    expect(setPath({ a: { b: 1 } }, "a.c", 3)).toEqual({ a: { b: 1, c: 3 } });
  });

  it("preserves siblings along the path", () => {
    const obj = { a: { b: 1, c: { d: 2, e: 3 } } };
    const next = setPath(obj, "a.c.d", 99);
    expect(next).toEqual({ a: { b: 1, c: { d: 99, e: 3 } } });
    expect(obj.a.c.d).toBe(2);
  });
});

const baseTheme: OsTheme = {
  id: "test",
  name: "Test",
  palette: {
    background: "#000",
    surface: "#111",
    textPrimary: "#fff",
    textSecondary: "#888",
    accent: "#0080ff",
    border: "#222",
  },
  shape: { windowRadius: 12, dockTileRadius: 14, small: 6 },
  motion: {
    windowOpenDurationMs: 180,
    windowOpenEasing: "ease-out",
    dockHoverDurationMs: 140,
    genieDurationMs: 280,
    genieEasing: "ease",
  },
  blur: { surface: "blur(20px)", spotlight: "blur(28px)" },
  wallpaper: {},
  chrome: {
    windowControls: "traffic-lights",
    dockPosition: "bottom",
    menuBar: "top",
  },
  customizable: {
    "palette.accent": {
      kind: "color-from-palette",
      label: "Accent",
      options: ["#0080ff", "#ff8000", "#00ff80"],
    },
    "shape.dockTileRadius": {
      kind: "range",
      label: "Dock radius",
      min: 0,
      max: 24,
      step: 2,
    },
  },
};

describe("applyPrefs", () => {
  it("returns the input theme when no customizable is declared", () => {
    const { customizable: _omit, ...rest } = baseTheme;
    void _omit;
    const themeNoCustom: OsTheme = rest;
    expect(applyPrefs(themeNoCustom, { "palette.accent": "#ffffff" })).toBe(
      themeNoCustom,
    );
  });

  it("returns the input theme when prefs are empty", () => {
    expect(applyPrefs(baseTheme, {})).toEqual(baseTheme);
  });

  it("overlays a declared pref onto the theme", () => {
    const next = applyPrefs(baseTheme, { "palette.accent": "#ff8000" });
    expect(next.palette.accent).toBe("#ff8000");
    expect(next.palette.background).toBe("#000");
  });

  it("ignores prefs for paths the theme didn't declare", () => {
    const next = applyPrefs(baseTheme, {
      "palette.background": "#ffffff",
      "shape.dockTileRadius": 20,
    });
    expect(next.palette.background).toBe("#000");
    expect(next.shape.dockTileRadius).toBe(20);
  });

  it("ignores undefined values (treats them as reset)", () => {
    const next = applyPrefs(baseTheme, { "palette.accent": undefined });
    expect(next.palette.accent).toBe("#0080ff");
  });
});
