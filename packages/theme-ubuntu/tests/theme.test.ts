import { describe, expect, it } from "vitest";
import { createUbuntuTheme } from "../src";

describe("createUbuntuTheme", () => {
  const t = createUbuntuTheme();

  it("identifies as the Ubuntu clone", () => {
    expect(t.id).toBe("ubuntu");
    expect(t.chrome.windowControls).toBe("gnome");
    expect(t.chrome.dockPosition).toBe("left");
    expect(t.chrome.dockStyle).toBe("bar");
  });

  it("carries the GNOME sizing and icon style", () => {
    expect(t.chrome.iconStyle).toBe("gnome");
    expect(t.chrome.dockTileSize).toBe(56);
    expect(t.chrome.menuBarHeight).toBe(30);
  });

  it("uses the Ubuntu Circle of Friends for the launcher button", () => {
    expect(t.chrome.launcherIcon).toBe("ubuntu");
  });

  it("uses the Ubuntu font stack", () => {
    expect(t.font).toContain("Ubuntu");
  });
});
