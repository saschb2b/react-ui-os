import { describe, expect, it } from "vitest";
import {
  initialWindowManagerState,
  windowManagerReducer,
} from "../src/window-manager/reducer";
import type {
  WindowManagerAction,
  WindowManagerState,
} from "../src/window-manager/types";
import { windowIdOf } from "../src/window-manager/types";

function run(
  ...actions: WindowManagerAction[]
): WindowManagerState {
  return actions.reduce(windowManagerReducer, initialWindowManagerState);
}

describe("windowManagerReducer", () => {
  it("opens a new app window with a stable id and focuses it", () => {
    const s = run({ type: "OPEN", payload: { kind: "app", appId: "hello" } });
    expect(s.windows).toHaveLength(1);
    expect(s.windows[0]?.id).toBe("app:hello");
    expect(s.windows[0]?.state).toBe("normal");
    expect(s.focusedId).toBe("app:hello");
  });

  it("opening the same app twice focuses (doesn't spawn duplicate)", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "hello" } },
      { type: "OPEN", payload: { kind: "app", appId: "world" } },
      { type: "OPEN", payload: { kind: "app", appId: "hello" } },
    );
    expect(s.windows).toHaveLength(2);
    expect(s.focusedId).toBe("app:hello");
    // hello should have the higher z because it was opened most recently.
    const hello = s.windows.find((w) => w.id === "app:hello");
    const world = s.windows.find((w) => w.id === "app:world");
    expect(hello && world && hello.z > world.z).toBe(true);
  });

  it("close removes the window and re-focuses the next-top", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "OPEN", payload: { kind: "app", appId: "b" } },
      { type: "CLOSE", id: "app:b" },
    );
    expect(s.windows).toHaveLength(1);
    expect(s.focusedId).toBe("app:a");
  });

  it("close while not focused leaves the focus alone", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "OPEN", payload: { kind: "app", appId: "b" } },
      { type: "CLOSE", id: "app:a" },
    );
    expect(s.focusedId).toBe("app:b");
  });

  it("minimize flips state and clears focus when the focused window minimizes", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "OPEN", payload: { kind: "app", appId: "b" } },
      { type: "MINIMIZE", id: "app:b" },
    );
    const b = s.windows.find((w) => w.id === "app:b");
    expect(b?.state).toBe("minimized");
    expect(s.focusedId).toBe("app:a");
  });

  it("restore brings a minimized window back and focuses it", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "MINIMIZE", id: "app:a" },
      { type: "RESTORE", id: "app:a" },
    );
    const a = s.windows.find((w) => w.id === "app:a");
    expect(a?.state).toBe("normal");
    expect(s.focusedId).toBe("app:a");
  });

  it("toggle maximize cycles normal -> maximized -> normal", () => {
    let s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "MAXIMIZE_TOGGLE", id: "app:a" },
    );
    expect(s.windows[0]?.state).toBe("maximized");
    s = windowManagerReducer(s, { type: "MAXIMIZE_TOGGLE", id: "app:a" });
    expect(s.windows[0]?.state).toBe("normal");
  });

  it("move updates x/y only", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "MOVE", id: "app:a", x: 200, y: 150 },
    );
    expect(s.windows[0]?.x).toBe(200);
    expect(s.windows[0]?.y).toBe(150);
  });

  it("FOCUS bumps z above all others", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "OPEN", payload: { kind: "app", appId: "b" } },
      { type: "OPEN", payload: { kind: "app", appId: "c" } },
      { type: "FOCUS", id: "app:a" },
    );
    const a = s.windows.find((w) => w.id === "app:a");
    const otherMax = Math.max(
      ...s.windows.filter((w) => w.id !== "app:a").map((w) => w.z),
    );
    expect(a && a.z > otherMax).toBe(true);
    expect(s.focusedId).toBe("app:a");
  });

  it("system windows share the prefix `system:` but a distinct systemId", () => {
    expect(windowIdOf({ kind: "system", systemId: "settings" })).toBe(
      "system:settings",
    );
  });

  it("CLOSE of an unknown id is a no-op", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "CLOSE", id: "app:ghost" },
    );
    expect(s.windows).toHaveLength(1);
    expect(s.focusedId).toBe("app:a");
  });
});
