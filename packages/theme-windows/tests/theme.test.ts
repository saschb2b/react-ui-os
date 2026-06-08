import { describe, expect, it } from "vitest";
import { createWindowsTheme } from "../src";

describe("createWindowsTheme", () => {
  const t = createWindowsTheme();

  it("identifies as the Windows clone", () => {
    expect(t.id).toBe("windows");
    expect(t.chrome.windowControls).toBe("windows");
    expect(t.chrome.dockStyle).toBe("bar");
  });

  it("carries the Windows 11 taskbar tokens", () => {
    expect(t.chrome.iconStyle).toBe("fluent");
    expect(t.chrome.dockTileSize).toBe(40);
    expect(t.chrome.showDesktopButton).toBe(true);
    expect(t.chrome.taskViewButton).toBe(true);
    expect(t.chrome.taskbarContextMenu).toBe(true);
  });

  it("uses the Segoe UI font stack", () => {
    expect(t.font).toContain("Segoe UI");
  });

  it("returns a fresh object so accent overrides don't leak between consumers", () => {
    expect(createWindowsTheme({ accent: "#123456" }).palette.accent).toBe("#123456");
    expect(createWindowsTheme().palette.accent).not.toBe("#123456");
  });
});
