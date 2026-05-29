import { describe, expect, it } from "vitest";
import { filterAndSortItems } from "../src/util/explorer-sort";

interface Item {
  id: string;
  name: string;
  kind?: string;
  timestamp?: number;
}

const items: Item[] = [
  { id: "a", name: "Item 10", kind: "Folder", timestamp: 300 },
  { id: "b", name: "Item 2", kind: "Document", timestamp: 100 },
  { id: "c", name: "item 1", kind: "Image", timestamp: 200 },
];

function names(list: Item[]): string[] {
  return list.map((it) => it.name);
}

describe("filterAndSortItems", () => {
  it("sorts names with natural numeric order, not lexicographic", () => {
    // The whole point: "Item 2" must come before "Item 10". A plain
    // localeCompare would order "Item 10" first because "1" < "2".
    const sorted = filterAndSortItems(items, {
      query: "",
      sort: "name",
      dir: "asc",
    });
    expect(names(sorted)).toEqual(["item 1", "Item 2", "Item 10"]);
  });

  it("treats name case-insensitively when sorting", () => {
    const sorted = filterAndSortItems(
      [
        { id: "1", name: "banana" },
        { id: "2", name: "Apple" },
      ],
      { query: "", sort: "name", dir: "asc" },
    );
    expect(names(sorted)).toEqual(["Apple", "banana"]);
  });

  it("reverses order for descending direction", () => {
    const sorted = filterAndSortItems(items, {
      query: "",
      sort: "name",
      dir: "desc",
    });
    expect(names(sorted)).toEqual(["Item 10", "Item 2", "item 1"]);
  });

  it("sorts by timestamp for the date field", () => {
    const sorted = filterAndSortItems(items, {
      query: "",
      sort: "date",
      dir: "asc",
    });
    expect(names(sorted)).toEqual(["Item 2", "item 1", "Item 10"]);
  });

  it("sorts by kind with missing kinds treated as empty", () => {
    const withMissing: Item[] = [
      { id: "x", name: "Zed" },
      { id: "y", name: "Ann", kind: "Document" },
    ];
    const sorted = filterAndSortItems(withMissing, {
      query: "",
      sort: "kind",
      dir: "asc",
    });
    // Empty kind sorts before "Document".
    expect(names(sorted)).toEqual(["Zed", "Ann"]);
  });

  it("filters by name or kind, case-insensitively", () => {
    expect(names(filterAndSortItems(items, { query: "image", sort: "name", dir: "asc" }))).toEqual([
      "item 1",
    ]);
    expect(names(filterAndSortItems(items, { query: "ITEM", sort: "name", dir: "asc" }))).toEqual([
      "item 1",
      "Item 2",
      "Item 10",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = items.slice();
    const order = names(input);
    filterAndSortItems(input, { query: "", sort: "name", dir: "asc" });
    expect(names(input)).toEqual(order);
  });

  it("ignores leading and trailing whitespace in the query", () => {
    expect(
      names(filterAndSortItems(items, { query: "  image  ", sort: "name", dir: "asc" })),
    ).toEqual(["item 1"]);
  });
});
