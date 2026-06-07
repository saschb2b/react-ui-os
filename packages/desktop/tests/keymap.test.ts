import { describe, expect, it } from "vitest";
import {
  chordOf,
  expandChord,
  findConflicts,
  formatChord,
  SHORTCUTS,
  type Shortcut,
} from "../src/keymap";

describe("chordOf", () => {
  it("canonicalizes the modifiers in a fixed order", () => {
    const ev = (over: Partial<KeyboardEvent>) =>
      chordOf({
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        key: "x",
        ...over,
      } as KeyboardEvent);
    expect(ev({ ctrlKey: true, key: "ArrowUp" })).toBe("ctrl+arrowup");
    expect(ev({ ctrlKey: true, altKey: true, key: "ArrowLeft" })).toBe(
      "ctrl+alt+arrowleft",
    );
    expect(ev({ metaKey: true, key: "K" })).toBe("meta+k");
    expect(ev({ ctrlKey: true, altKey: true, shiftKey: true, key: "ArrowRight" })).toBe(
      "ctrl+alt+shift+arrowright",
    );
  });
});

describe("expandChord", () => {
  it("expands Mod into both ctrl and meta", () => {
    expect(expandChord("Mod+K")).toEqual(["ctrl+k", "meta+k"]);
  });

  it("orders modifiers canonically regardless of how they're written", () => {
    expect(expandChord("Shift+Alt+Ctrl+ArrowLeft")).toEqual([
      "ctrl+alt+shift+arrowleft",
    ]);
  });

  it("leaves a bare key alone", () => {
    expect(expandChord("F3")).toEqual(["f3"]);
  });
});

describe("findConflicts", () => {
  const s = (id: string, chords: string[], scope: Shortcut["scope"]): Shortcut => ({
    id,
    chords,
    label: id,
    group: "",
    scope,
  });

  it("flags two shortcuts that claim the same chord in one scope", () => {
    // The exact clash the registry was built to catch: Mod+ArrowUp (maximize)
    // expands to ctrl+arrowup, colliding with Ctrl+ArrowUp (mission control).
    const conflicts = findConflicts([
      s("window.maximize", ["Mod+ArrowUp"], "desktop"),
      s("space.missionControl", ["Ctrl+ArrowUp"], "desktop"),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.chord).toBe("ctrl+arrowup");
    expect(conflicts[0]?.ids.sort()).toEqual([
      "space.missionControl",
      "window.maximize",
    ]);
  });

  it("allows the same chord in different scopes", () => {
    expect(
      findConflicts([
        s("a", ["Escape"], "desktop"),
        s("b", ["Escape"], "mission-control"),
        s("c", ["Escape"], "app-switcher"),
      ]),
    ).toEqual([]);
  });

  it("the shipped registry has no clashes", () => {
    expect(findConflicts(SHORTCUTS)).toEqual([]);
  });
});

describe("formatChord", () => {
  it("glues mac symbols and spaces pc words", () => {
    expect(formatChord("Mod+Shift+ArrowLeft", true)).toBe("⌘⇧←");
    expect(formatChord("Mod+Shift+ArrowLeft", false)).toBe("Ctrl + Shift + ←");
  });

  it("maps Mod to the platform's primary key", () => {
    expect(formatChord("Mod+W", true)).toBe("⌘W");
    expect(formatChord("Mod+W", false)).toBe("Ctrl + W");
  });

  it("gives arrows and Escape glyphs, and uppercases a single letter", () => {
    expect(formatChord("Mod+ArrowUp", false)).toBe("Ctrl + ↑");
    expect(formatChord("Escape", false)).toBe("Esc");
    expect(formatChord("F3", false)).toBe("F3");
  });

  it("passes a range display through unchanged", () => {
    expect(formatChord("Mod+1–9", false)).toBe("Ctrl + 1–9");
  });
});
