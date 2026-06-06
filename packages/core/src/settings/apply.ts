import type { OsTheme, ResolvedAppearance, SettingsPrefs } from "../types";

/**
 * Read a dotted-path value from an object. Returns `undefined` when any
 * segment of the path is missing.
 *
 *   getPath({ a: { b: 1 } }, "a.b")  // 1
 *   getPath({ a: { b: 1 } }, "a.c")  // undefined
 */
export function getPath(obj: unknown, path: string): unknown {
  if (path.length === 0) return obj;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Return a new object with `value` written at the dotted path. Shallow-clones
 * each segment along the path so the input is not mutated. Missing
 * intermediate objects are created.
 *
 *   setPath({ a: { b: 1 } }, "a.b", 2)        // { a: { b: 2 } }
 *   setPath({ a: { b: 1 } }, "a.c", 3)        // { a: { b: 1, c: 3 } }
 *   setPath({}, "a.b.c", 4)                   // { a: { b: { c: 4 } } }
 */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  if (path.length === 0) return value as T;
  const parts = path.split(".");
  const root: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (key === undefined) continue;
    const next = cur[key];
    const cloned: Record<string, unknown> =
      next !== null && typeof next === "object"
        ? { ...(next as Record<string, unknown>) }
        : {};
    cur[key] = cloned;
    cur = cloned;
  }
  const leaf = parts[parts.length - 1];
  if (leaf !== undefined) cur[leaf] = value;
  return root as T;
}

/**
 * Overlay user prefs on top of a theme to produce the effective theme. Only
 * paths the theme declared as `customizable` get applied; anything else in
 * `prefs` is ignored so a stale stored pref (a field the theme removed)
 * can't poison the effective theme.
 */
export function applyPrefs(theme: OsTheme, prefs: SettingsPrefs): OsTheme {
  const customizable = theme.customizable;
  if (!customizable) return theme;
  let result: OsTheme = theme;
  for (const [path, value] of Object.entries(prefs)) {
    if (!(path in customizable)) continue;
    if (value === undefined) continue;
    result = setPath(result, path, value);
  }
  return result;
}

/**
 * Overlay a theme's variant tokens for the resolved appearance, giving one
 * theme object a light and a dark look. The theme's base palette stands for
 * whichever mode it was authored in; `appearances[mode]` supplies the other.
 * A no-op when the requested mode is the base (no matching variant). The "auto"
 * resolution to a concrete light/dark mode is the caller's job (it needs the OS
 * color scheme).
 */
export function applyAppearance(theme: OsTheme, mode: ResolvedAppearance): OsTheme {
  const variant = theme.appearances?.[mode];
  if (!variant) return theme;
  return {
    ...theme,
    palette: { ...theme.palette, ...variant.palette },
    elevation: variant.elevation ?? theme.elevation,
    blur: { ...theme.blur, ...variant.blur },
    wallpaper: { ...theme.wallpaper, ...variant.wallpaper },
  };
}
