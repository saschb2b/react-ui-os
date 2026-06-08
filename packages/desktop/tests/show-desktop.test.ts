import { describe, expect, it } from "vitest";
import type { OpenWindow } from "@react-ui-os/core";
import { planShowDesktop } from "../src/util/show-desktop";

function win(id: string, workspaceId: string, state: OpenWindow["state"]): OpenWindow {
  return {
    id,
    workspaceId,
    state,
    payload: { kind: "app", appId: id },
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    z: 1,
  };
}

describe("planShowDesktop", () => {
  it("minimizes every visible window on the active workspace and stashes them", () => {
    const windows = [win("a", "1", "normal"), win("b", "1", "maximized")];
    const plan = planShowDesktop(windows, "1", []);
    expect(plan.minimize).toEqual(["a", "b"]);
    expect(plan.restore).toEqual([]);
    expect(plan.nextStash).toEqual(["a", "b"]);
  });

  it("ignores windows on other workspaces", () => {
    const windows = [win("a", "1", "normal"), win("b", "2", "normal")];
    expect(planShowDesktop(windows, "1", []).minimize).toEqual(["a"]);
  });

  it("restores the stash when the desktop is already clear", () => {
    const windows = [win("a", "1", "minimized"), win("b", "1", "minimized")];
    const plan = planShowDesktop(windows, "1", ["a"]);
    expect(plan.minimize).toEqual([]);
    expect(plan.restore).toEqual(["a"]);
    expect(plan.nextStash).toEqual([]);
  });

  it("restores everything minimized here when there is no stash", () => {
    const windows = [win("a", "1", "minimized"), win("b", "1", "minimized")];
    expect(planShowDesktop(windows, "1", []).restore).toEqual(["a", "b"]);
  });

  it("skips stashed windows that no longer exist", () => {
    const windows = [win("a", "1", "minimized")];
    expect(planShowDesktop(windows, "1", ["a", "gone"]).restore).toEqual(["a"]);
  });

  it("minimizes (not restores) when some windows are still visible", () => {
    const windows = [win("a", "1", "normal"), win("b", "1", "minimized")];
    const plan = planShowDesktop(windows, "1", []);
    expect(plan.minimize).toEqual(["a"]);
    expect(plan.restore).toEqual([]);
  });
});
