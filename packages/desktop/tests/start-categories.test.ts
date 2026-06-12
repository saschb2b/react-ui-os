import { describe, expect, it } from "vitest";
import {
  groupByCategory,
  MIN_CATEGORY_APPS,
  OTHER_CATEGORY,
} from "../src/launcher/start-categories";

const app = (name: string, category?: string) => ({ name, category });

describe("groupByCategory", () => {
  it("renders a category only once it holds at least three apps", () => {
    const groups = groupByCategory([
      app("A", "Productivity"),
      app("B", "Productivity"),
      app("C", "Productivity"),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Productivity"]);
    expect(MIN_CATEGORY_APPS).toBe(3);
  });

  it("folds an undersized category into Other", () => {
    const groups = groupByCategory([
      app("A", "Productivity"),
      app("B", "Productivity"),
      app("C", "Creativity"),
      app("D", "Creativity"),
    ]);
    // Neither reaches three, so both collapse to a single Other group.
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe(OTHER_CATEGORY);
    expect(groups[0]?.items.map((i) => i.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("files uncategorized apps under Other", () => {
    const groups = groupByCategory([app("Loose"), app("Also loose")]);
    expect(groups.map((g) => g.name)).toEqual([OTHER_CATEGORY]);
  });

  it("sorts named categories alphabetically and keeps Other last", () => {
    const groups = groupByCategory([
      app("u1", "Utilities"),
      app("u2", "Utilities"),
      app("u3", "Utilities"),
      app("c1", "Creativity"),
      app("c2", "Creativity"),
      app("c3", "Creativity"),
      app("x", "Solo"),
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      "Creativity",
      "Utilities",
      OTHER_CATEGORY,
    ]);
  });

  it("sorts the items inside Other but preserves named-category order", () => {
    const groups = groupByCategory([
      app("z", "Games"),
      app("a", "Games"),
      app("m", "Games"),
      app("Beta"),
      app("Alpha"),
    ]);
    // Named category keeps insertion order (caller sorts upstream); Other is
    // re-sorted because it is assembled from scattered leftovers.
    expect(groups[0]?.items.map((i) => i.name)).toEqual(["z", "a", "m"]);
    expect(groups[1]?.items.map((i) => i.name)).toEqual(["Alpha", "Beta"]);
  });

  it("never emits an empty Other group", () => {
    const groups = groupByCategory([
      app("a", "Games"),
      app("b", "Games"),
      app("c", "Games"),
    ]);
    expect(groups.some((g) => g.name === OTHER_CATEGORY)).toBe(false);
  });
});
