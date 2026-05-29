import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageAdapter } from "../src/storage/local-storage";

// A minimal stand-in for `window`: a Map-backed localStorage plus a tiny
// event bus, so the adapter's CustomEvent change bus and its native
// "storage" listener can be exercised without a real DOM. The adapter
// constructs its own CustomEvent (a Node global); the bus only routes by
// event type, so the test never touches DOM constructors itself.
type FakeEvent = { type: string } & Record<string, unknown>;
function makeFakeWindow() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(e: FakeEvent) => void>>();
  return {
    store,
    localStorage: {
      getItem(key: string): string | null {
        return store.has(key) ? (store.get(key) as string) : null;
      },
      setItem(key: string, value: string): void {
        store.set(key, value);
      },
      removeItem(key: string): void {
        store.delete(key);
      },
    },
    addEventListener(type: string, fn: (e: FakeEvent) => void): void {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: (e: FakeEvent) => void): void {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event: FakeEvent): boolean {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return true;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createLocalStorageAdapter (no window / SSR)", () => {
  it("is a safe no-op when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    const adapter = createLocalStorageAdapter();
    expect(adapter.get("anything")).toBeNull();
    expect(() => adapter.set("k", 1)).not.toThrow();
    expect(() => adapter.remove("k")).not.toThrow();
    const unsubscribe = adapter.subscribe(() => {
      throw new Error("listener must not fire under SSR");
    });
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("createLocalStorageAdapter (with window)", () => {
  it("round-trips JSON values under a namespaced key", () => {
    const fake = makeFakeWindow();
    vi.stubGlobal("window", fake);
    const adapter = createLocalStorageAdapter();
    adapter.set("theme", { accent: "#fff", n: 2 });
    expect(adapter.get("theme")).toEqual({ accent: "#fff", n: 2 });
    // The stored key carries the default prefix, not the bare key.
    expect(fake.store.has("rui-os:theme")).toBe(true);
    expect(fake.store.has("theme")).toBe(false);
  });

  it("honors a custom prefix", () => {
    const fake = makeFakeWindow();
    vi.stubGlobal("window", fake);
    const adapter = createLocalStorageAdapter("myapp");
    adapter.set("flag", true);
    expect(fake.store.has("myapp:flag")).toBe(true);
    expect(adapter.get("flag")).toBe(true);
  });

  it("returns null for a missing key", () => {
    vi.stubGlobal("window", makeFakeWindow());
    expect(createLocalStorageAdapter().get("nope")).toBeNull();
  });

  it("returns null and swallows malformed stored JSON", () => {
    const fake = makeFakeWindow();
    vi.stubGlobal("window", fake);
    fake.store.set("rui-os:broken", "{ not valid json");
    expect(createLocalStorageAdapter().get("broken")).toBeNull();
  });

  it("swallows serialization errors on set without throwing", () => {
    vi.stubGlobal("window", makeFakeWindow());
    const adapter = createLocalStorageAdapter();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => adapter.set("circular", circular)).not.toThrow();
    // Nothing usable was written, so reading back is null.
    expect(adapter.get("circular")).toBeNull();
  });

  it("notifies subscribers with the unprefixed key on set", () => {
    vi.stubGlobal("window", makeFakeWindow());
    const adapter = createLocalStorageAdapter();
    const seen: string[] = [];
    adapter.subscribe((key) => seen.push(key));
    adapter.set("downloads", [1, 2, 3]);
    expect(seen).toEqual(["downloads"]);
  });

  it("notifies subscribers and clears the value on remove", () => {
    const fake = makeFakeWindow();
    vi.stubGlobal("window", fake);
    const adapter = createLocalStorageAdapter();
    adapter.set("session", "x");
    const seen: string[] = [];
    adapter.subscribe((key) => seen.push(key));
    adapter.remove("session");
    expect(seen).toEqual(["session"]);
    expect(adapter.get("session")).toBeNull();
  });

  it("stops delivering after unsubscribe", () => {
    vi.stubGlobal("window", makeFakeWindow());
    const adapter = createLocalStorageAdapter();
    const seen: string[] = [];
    const unsubscribe = adapter.subscribe((key) => seen.push(key));
    adapter.set("a", 1);
    unsubscribe();
    adapter.set("b", 2);
    expect(seen).toEqual(["a"]);
  });

  it("relays cross-tab storage events, stripping the prefix", () => {
    const fake = makeFakeWindow();
    vi.stubGlobal("window", fake);
    const adapter = createLocalStorageAdapter();
    const seen: string[] = [];
    adapter.subscribe((key) => seen.push(key));

    fake.dispatchEvent({ type: "storage", key: "rui-os:prefs", newValue: "1" });
    fake.dispatchEvent({ type: "storage", key: "other-app:prefs", newValue: "1" });

    // Only the prefixed key is relayed, and it arrives without the prefix.
    expect(seen).toEqual(["prefs"]);
  });
});
