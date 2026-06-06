import { describe, expect, it } from "vitest";
import { applyAppearance, applyPrefs, getPath, setPath } from "../src/settings/apply";
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
    missionControlDurationMs: 220,
    missionControlEasing: "ease-out",
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

const dualTheme: OsTheme = {
  ...baseTheme,
  appearances: {
    dark: {
      palette: { background: "#1e1e1e", surface: "#262626", textPrimary: "#eee" },
      elevation: { windowFocused: "0 1px dark", windowUnfocused: "0 1px dark" },
    },
  },
};

describe("applyAppearance", () => {
  it("returns the theme unchanged for light", () => {
    expect(applyAppearance(dualTheme, "light")).toBe(dualTheme);
  });

  it("overlays the dark palette and elevation for dark, keeping the accent", () => {
    const next = applyAppearance(dualTheme, "dark");
    expect(next.palette.background).toBe("#1e1e1e");
    expect(next.palette.textPrimary).toBe("#eee");
    // Tokens not in the dark variant are inherited from the base.
    expect(next.palette.accent).toBe("#0080ff");
    expect(next.palette.border).toBe("#222");
    expect(next.elevation?.windowFocused).toBe("0 1px dark");
  });

  it("is a no-op for dark when the theme has no dark variant", () => {
    expect(applyAppearance(baseTheme, "dark")).toBe(baseTheme);
  });

  it("overlays a light variant for a dark-base theme", () => {
    const darkBase: OsTheme = {
      ...baseTheme,
      appearances: {
        light: { palette: { background: "#ffffff", textPrimary: "#111" } },
      },
    };
    const light = applyAppearance(darkBase, "light");
    expect(light.palette.background).toBe("#ffffff");
    expect(light.palette.textPrimary).toBe("#111");
    expect(light.palette.accent).toBe("#0080ff");
    // Dark is this theme's base, so the dark resolution is a no-op.
    expect(applyAppearance(darkBase, "dark")).toBe(darkBase);
  });
});
