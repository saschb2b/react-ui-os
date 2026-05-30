// Generates the static registry JSON the docs site serves at /r/<name>.json.
// Each file is what `npx shadcn add <url>` fetches to copy an app into a
// consumer's project. The source of truth is the repo-root registry.json;
// this step inlines every referenced source file's content into one JSON per
// item plus an index. Output lives under the docs public dir so it deploys
// with the site. Mirrors the extract-types.mjs prebuild pattern.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

// Locate the shadcn CLI from the workspace root's node_modules (it is a root
// devDependency) so this does not depend on PATH or pnpm hoisting. Read the
// manifest by path rather than require.resolve: shadcn's exports field does
// not expose ./package.json, which blocks the resolver.
const pkgDir = join(repoRoot, "node_modules", "shadcn");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.shadcn;
const binPath = join(pkgDir, binRel);

// shadcn resolves the files[].path entries relative to its cwd, so run it from
// the repo root where packages/example-apps/... lives, and emit into the docs
// public dir.
const result = spawnSync(
  process.execPath,
  [binPath, "build", "registry.json", "--output", "apps/docs/public/r"],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
