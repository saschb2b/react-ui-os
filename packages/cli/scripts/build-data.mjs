// Bundles the app sources into the CLI. Reads the repo-root registry.json
// (the manifest of available apps) and inlines every listed file's content
// into src/apps.data.json, which the CLI imports and tsup bundles into the
// published binary. The CLI ships fully self-contained: no network, no
// dependency on the example-apps package at install time. Mirrors the
// docs extract-types prebuild pattern.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

const manifest = JSON.parse(readFileSync(join(repoRoot, "registry.json"), "utf8"));

const apps = manifest.apps.map((app) => ({
  id: app.id,
  name: app.name,
  description: app.description,
  category: app.category,
  accent: app.accent,
  export: app.export,
  dependencies: app.dependencies,
  files: app.files.map((file) => ({
    name: file,
    content: readFileSync(join(repoRoot, app.dir, file), "utf8"),
  })),
}));

const out = { name: manifest.name, homepage: manifest.homepage, apps };
const outFile = resolve(here, "..", "src", "apps.data.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`[cli] bundled ${apps.length} apps -> ${outFile}`);
