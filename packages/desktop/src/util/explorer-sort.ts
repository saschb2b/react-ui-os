export type SortField = "date" | "name" | "kind";
export type SortDir = "asc" | "desc";

/** Minimal item shape the filter + sort needs; ExplorerItem satisfies it. */
interface SortableItem {
  id: string;
  name: string;
  kind?: string;
  timestamp?: number;
}

export interface FilterSortOptions {
  query: string;
  sort: SortField;
  dir: SortDir;
}

// Natural, case-insensitive collation so "Item 2" sorts before "Item 10".
// macOS Finder, Windows Explorer, and GNOME Files all order names this way;
// a plain localeCompare is lexicographic and would put "Item 10" first.
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Filter items by a query (matched against name and kind) then sort by the
 * given field and direction. Name and kind use natural collation; date sorts
 * on the numeric timestamp. Returns a new array; the input is not mutated.
 */
export function filterAndSortItems<I extends SortableItem>(
  items: I[],
  { query, sort, dir }: FilterSortOptions,
): I[] {
  const q = query.trim().toLowerCase();
  const matches = q
    ? items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.kind ?? "").toLowerCase().includes(q),
      )
    : items.slice();
  matches.sort((a, b) => {
    const cmp =
      sort === "name"
        ? collator.compare(a.name, b.name)
        : sort === "kind"
          ? collator.compare(a.kind ?? "", b.kind ?? "")
          : (a.timestamp ?? 0) - (b.timestamp ?? 0);
    return dir === "asc" ? cmp : -cmp;
  });
  return matches;
}
