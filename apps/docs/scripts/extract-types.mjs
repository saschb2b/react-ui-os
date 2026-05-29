// Walks a hand-picked list of source files in the workspace, extracts
// interface and type-alias declarations using the TypeScript Compiler
// API, and emits a single JSON file the docs site reads at build time.
//
// Why hand-picked: docs care about a tiny subset of exported types. A
// blanket "extract everything" would balloon the JSON and force every
// field rename to break the docs.
//
// Output shape:
//   { generatedAt, types: { [TypeName]: TypeSpec } }
//
// TypeSpec = {
//   name, package, kind: "interface" | "alias",
//   description, fields?: FieldSpec[], aliasOf?: string
// }
// FieldSpec = { name, type, optional, description }

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const outFile = resolve(__dirname, "..", "src", "data", "types.json");

/**
 * @typedef {Object} Target
 * @property {string} name        TypeScript identifier of the type to extract.
 * @property {string} sourceFile  Path relative to the repo root.
 * @property {string} package     Package the type ships from.
 */

/** @type {Target[]} */
const targets = [
  // Core / public-surface types
  {
    name: "App",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "AppContentProps",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsTheme",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsThemePalette",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsThemeShape",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsThemeMotion",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsThemeBlur",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsThemeWallpaper",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "OsThemeChrome",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "CustomizableField",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "ColorFromPaletteField",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "RangeField",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "SelectField",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "ToggleField",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  {
    name: "ImagePickField",
    sourceFile: "packages/core/src/types.ts",
    package: "@react-ui-os/core",
  },
  // Storage adapter
  {
    name: "StorageAdapter",
    sourceFile: "packages/core/src/storage/types.ts",
    package: "@react-ui-os/core",
  },
  // Desktop primitives
  {
    name: "SpotlightResult",
    sourceFile: "packages/desktop/src/spotlight-sources.ts",
    package: "@react-ui-os/desktop",
  },
  {
    name: "SpotlightSource",
    sourceFile: "packages/desktop/src/spotlight-sources.ts",
    package: "@react-ui-os/desktop",
  },
];

function readJsDoc(node) {
  const text = (ts.getJSDocCommentsAndTags(node) ?? [])
    .map((doc) => {
      if (typeof doc.comment === "string") return doc.comment;
      if (Array.isArray(doc.comment))
        return doc.comment.map((c) => c.text ?? "").join("");
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return text || undefined;
}

function memberTypeText(member, sourceFile) {
  // Method signatures need the full call signature, not just the return type.
  if (ts.isMethodSignature(member)) {
    const typeParams = member.typeParameters
      ?.map((tp) => tp.getText(sourceFile))
      .join(", ");
    const params = member.parameters.map((p) => p.getText(sourceFile)).join(", ");
    const ret = member.type ? member.type.getText(sourceFile) : "void";
    const generics = typeParams ? `<${typeParams}>` : "";
    return `${generics}(${params}) => ${ret}`;
  }
  if (member.type) {
    return member.type.getText(sourceFile).trim();
  }
  return "unknown";
}

function extractInterface(decl, sourceFile) {
  const fields = [];
  for (const member of decl.members) {
    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) {
      continue;
    }
    const name = member.name?.getText(sourceFile) ?? "?";
    const optional = Boolean(member.questionToken);
    const type = memberTypeText(member, sourceFile);
    const description = readJsDoc(member);
    fields.push({ name, type, optional, description });
  }
  return {
    kind: "interface",
    description: readJsDoc(decl),
    fields,
  };
}

function extractAlias(decl, sourceFile) {
  return {
    kind: "alias",
    description: readJsDoc(decl),
    aliasOf: decl.type.getText(sourceFile).trim(),
  };
}

function parseFile(absPath) {
  const text = readFileSync(absPath, "utf8");
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.ES2022, true);
}

function findDeclaration(sourceFile, name) {
  for (const stmt of sourceFile.statements) {
    if (
      (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) &&
      stmt.name.text === name
    ) {
      return stmt;
    }
  }
  return undefined;
}

function main() {
  const out = { generatedAt: new Date().toISOString(), types: {} };
  const errors = [];

  for (const target of targets) {
    const absPath = join(repoRoot, target.sourceFile);
    let source;
    try {
      source = parseFile(absPath);
    } catch (err) {
      errors.push(`Failed to read ${target.sourceFile}: ${String(err)}`);
      continue;
    }

    const decl = findDeclaration(source, target.name);
    if (!decl) {
      errors.push(`Could not find ${target.name} in ${target.sourceFile}`);
      continue;
    }

    const base = ts.isInterfaceDeclaration(decl)
      ? extractInterface(decl, source)
      : extractAlias(decl, source);

    out.types[target.name] = {
      name: target.name,
      package: target.package,
      sourceFile: target.sourceFile,
      ...base,
    };
  }

  if (errors.length) {
    for (const e of errors) console.error(`[extract-types] ${e}`);
    process.exit(1);
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n", "utf8");
  const count = Object.keys(out.types).length;
  console.log(`[extract-types] wrote ${count} types -> ${outFile}`);
}

main();
