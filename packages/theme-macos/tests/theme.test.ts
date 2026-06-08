import { describe, expect, it } from "vitest";
import { createMacosTheme } from "../src";

describe("createMacosTheme", () => {
  const t = createMacosTheme();

  it("identifies as the macOS clone", () => {
    expect(t.id).toBe("macos");
    expect(t.chrome.windowControls).toBe("traffic-lights");
  });

  it("uses a floating dock with macOS sizing and icon style", () => {
    expect(t.chrome.dockStyle ?? "floating").toBe("floating");
    expect(t.chrome.iconStyle).toBe("macos");
    expect(t.chrome.dockTileSize).toBe(56);
    expect(t.chrome.menuBarHeight).toBe(24);
  });

  it("uses the SF / system font stack", () => {
    expect(t.font?.toLowerCase()).toContain("apple");
  });
});
