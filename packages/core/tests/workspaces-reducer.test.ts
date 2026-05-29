import { describe, expect, it } from "vitest";
import {
  initialWindowManagerState,
  windowManagerReducer,
  DEFAULT_WORKSPACES,
} from "../src/window-manager/reducer";
import type {
  WindowManagerAction,
  WindowManagerState,
} from "../src/window-manager/types";

function run(...actions: WindowManagerAction[]): WindowManagerState {
  return actions.reduce(windowManagerReducer, initialWindowManagerState);
}

describe("workspaces in windowManagerReducer", () => {
  it("seeds three workspaces and starts on the first", () => {
    expect(initialWindowManagerState.workspaces).toEqual(DEFAULT_WORKSPACES);
    expect(initialWindowManagerState.activeWorkspaceId).toBe(DEFAULT_WORKSPACES[0]);
  });

  it("new windows inherit the active workspace", () => {
    const s = run(
      { type: "SWITCH_WORKSPACE", workspaceId: "2" },
      { type: "OPEN", payload: { kind: "app", appId: "hello" } },
    );
    expect(s.windows[0]?.workspaceId).toBe("2");
  });

  it("SWITCH_WORKSPACE updates focusedId to the new workspace's top window", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } }, // workspace 1
      { type: "SWITCH_WORKSPACE", workspaceId: "2" },
      { type: "OPEN", payload: { kind: "app", appId: "b" } }, // workspace 2
      { type: "SWITCH_WORKSPACE", workspaceId: "1" },
    );
    expect(s.activeWorkspaceId).toBe("1");
    expect(s.focusedId).toBe("app:a");
  });

  it("SWITCH_WORKSPACE to an empty workspace drops focus to null", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "SWITCH_WORKSPACE", workspaceId: "3" },
    );
    expect(s.activeWorkspaceId).toBe("3");
    expect(s.focusedId).toBeNull();
  });

  it("SWITCH_WORKSPACE to an unknown id is a no-op", () => {
    const s = run({ type: "SWITCH_WORKSPACE", workspaceId: "nope" });
    expect(s.activeWorkspaceId).toBe("1");
  });

  it("MOVE_WINDOW_TO_WORKSPACE re-tags the window", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "MOVE_WINDOW_TO_WORKSPACE", id: "app:a", workspaceId: "2" },
    );
    expect(s.windows[0]?.workspaceId).toBe("2");
  });

  it("moving the focused window away updates the active-workspace focus", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "OPEN", payload: { kind: "app", appId: "b" } },
      { type: "MOVE_WINDOW_TO_WORKSPACE", id: "app:b", workspaceId: "2" },
    );
    // b was focused (just opened) and just left workspace 1. Focus should
    // hand off to a, which is the only remaining window here.
    expect(s.focusedId).toBe("app:a");
  });

  it("focusing a window on another workspace switches workspaces", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "SWITCH_WORKSPACE", workspaceId: "2" },
      { type: "OPEN", payload: { kind: "app", appId: "b" } },
      { type: "FOCUS", id: "app:a" },
    );
    expect(s.activeWorkspaceId).toBe("1");
    expect(s.focusedId).toBe("app:a");
  });

  it("OPEN of an existing window on another workspace pulls the user there", () => {
    const s = run(
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "SWITCH_WORKSPACE", workspaceId: "2" },
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
    );
    expect(s.activeWorkspaceId).toBe("1");
    expect(s.focusedId).toBe("app:a");
  });

  it("ADD_WORKSPACE appends a new workspace id", () => {
    const s = run({ type: "ADD_WORKSPACE", workspaceId: "4" });
    expect(s.workspaces).toEqual(["1", "2", "3", "4"]);
  });

  it("ADD_WORKSPACE is idempotent for duplicates", () => {
    const s = run({ type: "ADD_WORKSPACE", workspaceId: "2" });
    expect(s.workspaces).toEqual(["1", "2", "3"]);
  });

  it("REMOVE_WORKSPACE migrates windows to the first remaining workspace", () => {
    const s = run(
      { type: "SWITCH_WORKSPACE", workspaceId: "2" },
      { type: "OPEN", payload: { kind: "app", appId: "a" } },
      { type: "REMOVE_WORKSPACE", workspaceId: "2" },
    );
    expect(s.workspaces).toEqual(["1", "3"]);
    expect(s.windows[0]?.workspaceId).toBe("1");
    expect(s.activeWorkspaceId).toBe("1");
  });

  it("REMOVE_WORKSPACE refuses to drop the last one", () => {
    const s = run(
      { type: "REMOVE_WORKSPACE", workspaceId: "2" },
      { type: "REMOVE_WORKSPACE", workspaceId: "3" },
      { type: "REMOVE_WORKSPACE", workspaceId: "1" },
    );
    expect(s.workspaces).toEqual(["1"]);
  });
});
