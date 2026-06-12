/**
 * Start menu Category-view grouping, the redesigned Windows 11 rule: an app
 * files under its declared category, a category renders only once it holds at
 * least three apps, and everything else (uncategorized apps and undersized
 * categories) folds into a trailing "Other" group. Named categories sort
 * alphabetically; Other always comes last.
 * Source: https://www.windowslatest.com/2025/06/18/you-cannot-create-new-categories-in-new-windows-11-start-menu/
 *
 * Pure over a minimal `{ name, category }` shape so it is testable without the
 * full launcher result type, and so the same rule can group anything that
 * carries a name and an optional category.
 */

export const MIN_CATEGORY_APPS = 3;
export const OTHER_CATEGORY = "Other";

export interface CategoryGroup<T> {
  name: string;
  items: T[];
}

export function groupByCategory<T extends { name: string; category?: string }>(
  items: T[],
): Array<CategoryGroup<T>> {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const name = item.category ?? OTHER_CATEGORY;
    const list = byCategory.get(name) ?? [];
    list.push(item);
    byCategory.set(name, list);
  }

  const named: Array<CategoryGroup<T>> = [];
  const other: T[] = [];
  for (const [name, list] of byCategory) {
    if (name !== OTHER_CATEGORY && list.length >= MIN_CATEGORY_APPS) {
      named.push({ name, items: list });
    } else {
      other.push(...list);
    }
  }

  named.sort((a, b) => a.name.localeCompare(b.name));
  if (other.length > 0) {
    other.sort((a, b) => a.name.localeCompare(b.name));
    named.push({ name: OTHER_CATEGORY, items: other });
  }
  return named;
}
