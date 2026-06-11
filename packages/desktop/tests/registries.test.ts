import { afterEach, describe, expect, it, vi } from "vitest";
import type { SystemWindowArgs } from "@react-ui-os/core";
import {
  listStatusItems,
  registerStatusItem,
  subscribeStatusItems,
  unregisterStatusItem,
} from "../src/status-items";
import {
  listSpotlightSources,
  registerSpotlightSource,
  subscribeSpotlightSources,
  type SpotlightResult,
} from "../src/spotlight-sources";
import {
  countRecentsSources,
  listRecentItems,
  registerRecentsSource,
  subscribeRecentsSources,
  type RecentItem,
} from "../src/recents";
import {
  getSystemWindow,
  listSystemWindows,
  registerSystemWindow,
  resolveSystemWindowName,
  systemWindows,
  type SystemWindowDef,
} from "../src/system-windows";

// The registries are module-level singletons, so each test cleans up after
// itself. cleanups runs the unsubscribe each test collected; the system-window
// registry has no unregister API, so test keys are deleted directly.
const cleanups: Array<() => void> = [];
const systemKeys: string[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  while (systemKeys.length) delete systemWindows[systemKeys.pop()!];
});

function track(unsub: () => void): () => void {
  cleanups.push(unsub);
  return unsub;
}

describe("status items", () => {
  it("lists items sorted by order, low numbers first", () => {
    track(registerStatusItem({ id: "a", icon: null, order: 200 }));
    track(registerStatusItem({ id: "b", icon: null, order: 50 }));
    expect(listStatusItems().map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("defaults a missing order to 100", () => {
    track(registerStatusItem({ id: "default", icon: null }));
    track(registerStatusItem({ id: "early", icon: null, order: 10 }));
    expect(listStatusItems().map((i) => i.id)).toEqual(["early", "default"]);
  });

  it("replaces a record when the same id re-registers", () => {
    track(registerStatusItem({ id: "battery", icon: null, badge: 78 }));
    track(registerStatusItem({ id: "battery", icon: null, badge: 42 }));
    const items = listStatusItems().filter((i) => i.id === "battery");
    expect(items).toHaveLength(1);
    expect(items[0]?.badge).toBe(42);
  });

  it("returns a stable snapshot reference until a mutation", () => {
    track(registerStatusItem({ id: "stable", icon: null }));
    const first = listStatusItems();
    expect(listStatusItems()).toBe(first);
    track(registerStatusItem({ id: "another", icon: null }));
    expect(listStatusItems()).not.toBe(first);
  });

  it("removes the item when its own unsubscribe runs", () => {
    const unsub = registerStatusItem({ id: "temp", icon: null });
    expect(listStatusItems().some((i) => i.id === "temp")).toBe(true);
    unsub();
    expect(listStatusItems().some((i) => i.id === "temp")).toBe(false);
  });

  it("makes a stale unsubscribe a no-op after the id is re-registered", () => {
    const staleUnsub = registerStatusItem({ id: "track", icon: null });
    // A new record under the same id supersedes the first. The first
    // registration's unsubscribe must not evict the live record.
    track(registerStatusItem({ id: "track", icon: null, badge: "live" }));
    staleUnsub();
    expect(listStatusItems().find((i) => i.id === "track")?.badge).toBe("live");
  });

  it("unregisters by id", () => {
    registerStatusItem({ id: "byid", icon: null });
    unregisterStatusItem("byid");
    expect(listStatusItems().some((i) => i.id === "byid")).toBe(false);
  });

  it("notifies subscribers on registration", () => {
    const listener = vi.fn();
    track(subscribeStatusItems(listener));
    track(registerStatusItem({ id: "notify", icon: null }));
    expect(listener).toHaveBeenCalled();
  });
});

describe("recents sources", () => {
  const item = (id: string, timestamp: number): RecentItem => ({
    id,
    name: id,
    timestamp,
    onActivate: () => {},
  });

  it("merges every source's items newest first, tagged with the source id", () => {
    track(registerRecentsSource("a", () => [item("old", 100), item("new", 300)]));
    track(registerRecentsSource("b", () => [item("mid", 200)]));
    const merged = listRecentItems();
    expect(merged.map((r) => r.id)).toEqual(["new", "mid", "old"]);
    expect(merged.map((r) => r.sourceId)).toEqual(["a", "b", "a"]);
  });

  it("replaces a source when the same id re-registers", () => {
    track(registerRecentsSource("dup", () => [item("first", 1)]));
    track(registerRecentsSource("dup", () => [item("second", 2)]));
    expect(listRecentItems().map((r) => r.id)).toEqual(["second"]);
  });

  it("drops a throwing source instead of failing the merge", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    track(
      registerRecentsSource("bad", () => {
        throw new Error("boom");
      }),
    );
    track(registerRecentsSource("good", () => [item("ok", 1)]));
    expect(listRecentItems().map((r) => r.id)).toEqual(["ok"]);
    warn.mockRestore();
  });

  it("counts sources and notifies subscribers on registration changes", () => {
    const listener = vi.fn();
    track(subscribeRecentsSources(listener));
    const before = countRecentsSources();
    const unsub = registerRecentsSource("counted", () => []);
    expect(countRecentsSources()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    expect(countRecentsSources()).toBe(before);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("spotlight sources", () => {
  const emptySource = (): SpotlightResult[] => [];

  it("lists sources in registration order", () => {
    const first = () => [{ id: "1", name: "one", onActivate: () => {} }];
    const second = () => [{ id: "2", name: "two", onActivate: () => {} }];
    track(registerSpotlightSource("first", first));
    track(registerSpotlightSource("second", second));
    const ids = listSpotlightSources().flatMap((s) => s("").map((r) => r.id));
    expect(ids).toEqual(["1", "2"]);
  });

  it("replaces a source when the same id re-registers", () => {
    track(
      registerSpotlightSource("dup", () => [
        { id: "old", name: "old", onActivate: () => {} },
      ]),
    );
    track(
      registerSpotlightSource("dup", () => [
        { id: "new", name: "new", onActivate: () => {} },
      ]),
    );
    const ids = listSpotlightSources().flatMap((s) => s("").map((r) => r.id));
    expect(ids).toEqual(["new"]);
  });

  it("removes the source on its own unsubscribe", () => {
    const unsub = registerSpotlightSource("temp", emptySource);
    expect(listSpotlightSources()).toHaveLength(1);
    unsub();
    expect(listSpotlightSources()).toHaveLength(0);
  });

  it("makes a stale unsubscribe a no-op after the id is re-registered", () => {
    const staleUnsub = registerSpotlightSource("keep", emptySource);
    const live = () => [{ id: "live", name: "live", onActivate: () => {} }];
    track(registerSpotlightSource("keep", live));
    staleUnsub();
    expect(listSpotlightSources()).toHaveLength(1);
  });

  it("notifies subscribers on registration", () => {
    const listener = vi.fn();
    track(subscribeSpotlightSources(listener));
    track(registerSpotlightSource("notify", emptySource));
    expect(listener).toHaveBeenCalled();
  });
});

describe("system windows", () => {
  const def: SystemWindowDef = {
    name: "Test Window",
    defaultBounds: { w: 100, h: 100 },
    content: () => null,
  };

  it("ships the built-in Settings window", () => {
    expect(getSystemWindow("settings")?.name).toBe("Settings");
  });

  it("registers and resolves a new system window", () => {
    systemKeys.push("test-win");
    registerSystemWindow("test-win", def);
    expect(getSystemWindow("test-win")).toBe(def);
    expect(listSystemWindows().some((w) => w.systemId === "test-win")).toBe(true);
  });

  it("lists windows in declaration order (built-ins before later registrations)", () => {
    systemKeys.push("test-late");
    registerSystemWindow("test-late", def);
    const ids = listSystemWindows().map((w) => w.systemId);
    expect(ids[0]).toBe("settings");
    expect(ids.indexOf("settings")).toBeLessThan(ids.indexOf("test-late"));
  });

  it("resolves a static name as-is", () => {
    expect(resolveSystemWindowName(def)).toBe("Test Window");
  });

  it("derives a per-instance name from args when name is a function", () => {
    const dynamic: SystemWindowDef = {
      name: (args?: SystemWindowArgs) => `Component: ${args?.name ?? "?"}`,
      defaultBounds: { w: 100, h: 100 },
      content: () => null,
    };
    expect(resolveSystemWindowName(dynamic, { name: "Spotlight" })).toBe(
      "Component: Spotlight",
    );
    expect(resolveSystemWindowName(dynamic)).toBe("Component: ?");
  });
});
