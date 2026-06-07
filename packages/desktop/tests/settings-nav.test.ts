import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRequestedSection,
  requestSettingsSection,
  subscribeSettingsNav,
} from "../src/settings-nav";

// settings-nav is a module-level singleton with no reset, so tests assert on
// the latest request and on relative nonce growth rather than absolute values,
// staying independent of execution order. Subscriptions are torn down after
// each test.
const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

describe("settings-nav", () => {
  it("records the most recent requested section", () => {
    requestSettingsSection("Taskbar");
    expect(getRequestedSection()?.section).toBe("Taskbar");
    requestSettingsSection("Appearance");
    expect(getRequestedSection()?.section).toBe("Appearance");
  });

  it("raises the nonce on every request so consumers apply each exactly once", () => {
    requestSettingsSection("A");
    const first = getRequestedSection()?.nonce ?? 0;
    requestSettingsSection("B");
    const second = getRequestedSection()?.nonce ?? 0;
    expect(second).toBeGreaterThan(first);
  });

  it("notifies subscribers on each request", () => {
    const listener = vi.fn();
    cleanups.push(subscribeSettingsNav(listener));
    requestSettingsSection("Taskbar");
    requestSettingsSection("Layout");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsub = subscribeSettingsNav(listener);
    requestSettingsSection("Taskbar");
    unsub();
    requestSettingsSection("Layout");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
