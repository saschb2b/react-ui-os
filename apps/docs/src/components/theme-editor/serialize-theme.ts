import type { OsTheme } from "@react-ui-os/core";

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const printKey = (key: string): string => (IDENT.test(key) ? key : JSON.stringify(key));

function printValue(value: unknown, indent: string): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const inner = `${indent}  `;
    const parts = value.map((v) => printValue(v, inner));
    const oneLine = `[${parts.join(", ")}]`;
    if (oneLine.length <= 72 && !oneLine.includes("\n")) return oneLine;
    return `[\n${parts.map((p) => `${inner}${p}`).join(",\n")},\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const inner = `${indent}  `;
    const body = entries
      .map(([k, v]) => `${inner}${printKey(k)}: ${printValue(v, inner)},`)
      .join("\n");
    return `{\n${body}\n${indent}}`;
  }
  return "undefined";
}

/** "my-theme" -> "myTheme"; anything unusable falls back to "myTheme". */
export function exportIdentifier(id: string): string {
  const camel = id
    .replace(/[^A-Za-z0-9]+([A-Za-z0-9])/g, (_match, c: string) => c.toUpperCase())
    .replace(/[^A-Za-z0-9_$]/g, "");
  const name = /^[A-Za-z_$]/.test(camel) ? camel : "myTheme";
  return /theme$/i.test(name) ? name : `${name}Theme`;
}

/**
 * Print a theme as a ready-to-paste TypeScript module. The output is a plain
 * object literal typed as OsTheme, with a usage note in the header; keys that
 * are not identifiers (the dotted `customizable` paths) are quoted.
 */
export function serializeTheme(theme: OsTheme): string {
  const name = exportIdentifier(theme.id);
  return `import type { OsTheme } from "@react-ui-os/core";

// Generated with the react-ui-os theme editor.
// Themes do not bundle assets: serve a wallpaper from your app's public/
// folder and set wallpaper.src to its URL.
//
// Usage:
//   import { ${name} } from "./${theme.id || "my-theme"}";
//   <Desktop apps={apps} theme={${name}} />;
export const ${name}: OsTheme = ${printValue(theme, "")};
`;
}
