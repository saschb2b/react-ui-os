import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import builtinData from "./apps.data.json";
import pkg from "../package.json";

interface AppFile {
  name: string;
  content: string;
}

interface App {
  id: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  export: string;
  dependencies: string[];
  files: AppFile[];
}

interface Registry {
  name: string;
  homepage?: string;
  apps: App[];
}

// The authoring shape a registry.json is written in: files may be bare
// basenames (read from `dir` at build time) or already-inlined { name, content }
// pairs. The built-in registry and any hosted registry are the inlined form.
interface RawApp {
  id: string;
  name: string;
  description?: string;
  category?: string;
  accent?: string;
  export: string;
  dependencies?: string[];
  dir?: string;
  files: Array<string | AppFile>;
}

interface RawRegistry {
  name: string;
  homepage?: string;
  apps: RawApp[];
}

const builtin = builtinData as unknown as Registry;

const useColor = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
const paint = (code: string) => (s: string) => (useColor ? `[${code}m${s}[0m` : s);
const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const green = paint("32");
const cyan = paint("36");

interface Args {
  command?: string;
  positionals: string[];
  dir?: string;
  registry?: string;
  out?: string;
  force: boolean;
  silent: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    positionals: [],
    force: false,
    silent: false,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--version" || a === "-v") args.version = true;
    else if (a === "--force" || a === "-f") args.force = true;
    else if (a === "--silent" || a === "-s") args.silent = true;
    else if (a === "--dir") args.dir = argv[++i];
    else if (a.startsWith("--dir=")) args.dir = a.slice("--dir=".length);
    else if (a === "--registry" || a === "-r") args.registry = argv[++i];
    else if (a.startsWith("--registry=")) args.registry = a.slice("--registry=".length);
    else if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
    else if (a.startsWith("-"))
      throw new Error(`Unknown option: ${a}. Run with --help.`);
    else if (args.command === undefined) args.command = a;
    else args.positionals.push(a);
  }
  return args;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

// Resolve an authoring registry into the inlined form. baseDir is the directory
// to read bare-basename files from; null when the source is remote (a hosted
// registry has no readable file tree, so it must already be inlined).
function normalizeRegistry(raw: RawRegistry, baseDir: string | null): Registry {
  const apps = raw.apps.map((app) => ({
    id: app.id,
    name: app.name,
    description: app.description ?? "",
    category: app.category ?? "",
    accent: app.accent ?? "",
    export: app.export,
    dependencies: app.dependencies ?? [],
    files: app.files.map((file) => {
      if (typeof file === "object" && typeof file.content === "string") {
        return { name: file.name, content: file.content };
      }
      if (baseDir === null) {
        throw new Error(
          `app "${app.id}" lists files without content. Build the registry first with: react-ui-os build`,
        );
      }
      const name = String(file);
      return {
        name,
        content: readFileSync(join(baseDir, app.dir ?? "", name), "utf8"),
      };
    }),
  }));
  return { name: raw.name, homepage: raw.homepage, apps };
}

const FETCH_TIMEOUT_MS = 15_000;

// Parse and shape-check registry JSON so a typo'd URL or a malformed file
// fails with a message naming the source and the problem, not a stack trace
// from deep inside normalize.
function parseRawRegistry(text: string, source: string): RawRegistry {
  const fail = (why: string): never => {
    throw new Error(`registry at ${source} is not valid: ${why}`);
  };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail("not JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("expected a JSON object");
  }
  const reg = value as Partial<RawRegistry>;
  if (typeof reg.name !== "string") return fail('missing a string "name"');
  if (!Array.isArray(reg.apps)) return fail('missing an "apps" array');
  for (const app of reg.apps as Array<Partial<RawApp> | null>) {
    if (typeof app !== "object" || app === null) {
      return fail("every apps[] entry must be an object");
    }
    for (const key of ["id", "name", "export"] as const) {
      if (typeof app[key] !== "string") {
        return fail(
          `app ${JSON.stringify(app.id ?? "?")} is missing a string "${key}"`,
        );
      }
    }
    if (!Array.isArray(app.files)) {
      return fail(`app "${app.id}" is missing a "files" array`);
    }
  }
  return reg as RawRegistry;
}

function readRegistryFile(source: string): string {
  const path = resolve(source);
  if (!existsSync(path)) {
    throw new Error(`registry file not found: ${source}`);
  }
  return readFileSync(path, "utf8");
}

async function loadRegistry(source: string): Promise<Registry> {
  let text: string;
  if (isUrl(source)) {
    let res: Response;
    try {
      res = await globalThis.fetch(source, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      const why =
        err instanceof Error && err.name === "TimeoutError"
          ? `timed out after ${FETCH_TIMEOUT_MS / 1000}s`
          : err instanceof Error && err.cause instanceof Error
            ? err.cause.message
            : err instanceof Error
              ? err.message
              : String(err);
      throw new Error(`could not fetch registry from ${source} (${why})`);
    }
    if (!res.ok) {
      throw new Error(`could not fetch registry from ${source} (${res.status})`);
    }
    text = await res.text();
  } else {
    text = readRegistryFile(source);
  }
  const raw = parseRawRegistry(text, source);
  return normalizeRegistry(raw, isUrl(source) ? null : dirname(resolve(source)));
}

async function resolveRegistry(args: Args): Promise<Registry> {
  return args.registry ? loadRegistry(args.registry) : builtin;
}

// Default landing spot: a project that keeps source in src/ gets src/os-apps,
// otherwise os-apps at the project root. --dir overrides either way.
function resolveBaseDir(args: Args): string {
  if (args.dir) return args.dir;
  return existsSync(join(process.cwd(), "src")) ? join("src", "os-apps") : "os-apps";
}

// Dependencies the project already declares, so the install hint only lists
// what is actually missing.
function installedDeps(cwd: string): Set<string> {
  try {
    const pkgJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(pkgJson.dependencies ?? {}),
      ...Object.keys(pkgJson.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

// Match the install hint to the project's tooling: the packageManager field
// wins, then the lockfile, then the npm default.
function detectInstallCommand(cwd: string): string {
  try {
    const pkgJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
      packageManager?: string;
    };
    const pm = pkgJson.packageManager;
    if (pm?.startsWith("pnpm")) return "pnpm add";
    if (pm?.startsWith("yarn")) return "yarn add";
    if (pm?.startsWith("bun")) return "bun add";
    if (pm?.startsWith("npm")) return "npm install";
  } catch {
    // No package.json or unreadable; fall through to the lockfiles.
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm add";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn add";
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb")))
    return "bun add";
  return "npm install";
}

const toPosix = (p: string) => p.split(/[\\/]/).join("/");

// App ids and file names from a registry become filesystem paths under the
// target directory. A hostile registry must not be able to write outside it,
// so reject absolute paths, drive-rooted paths, and ".." segments. File names
// may nest into subdirectories; ids may not.
const isSafeRelPath = (name: string) =>
  name.length > 0 &&
  !/^[a-zA-Z]:|^[\\/]/.test(name) &&
  name.split(/[\\/]/).every((part) => part !== "" && part !== "." && part !== "..");

const isSafeId = (id: string) => isSafeRelPath(id) && !/[\\/]/.test(id);

// Levenshtein distance; ids and commands are short, so the quadratic cost is
// irrelevant. Single-row rolling variant.
function editDistance(a: string, b: string): number {
  const row: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      const left = row[j - 1] ?? 0;
      row[j] = Math.min(above + 1, left + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = above;
    }
  }
  return row[b.length] ?? 0;
}

// Closest candidate to a typo, for "did you mean" hints. Only suggests a
// near-miss; anything further than two edits (or a third of the input, for
// longer names) is likely unrelated.
function closest(input: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = editDistance(input.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= Math.max(2, Math.floor(input.length / 3)) ? best : undefined;
}

// Shared by add and info: resolve an id or print the unknown-app error with a
// near-miss hint.
function lookupApp(registry: Registry, id: string): App | undefined {
  const app = registry.apps.find((a) => a.id === id);
  if (!app) {
    const hint = closest(
      id,
      registry.apps.map((a) => a.id),
    );
    console.error(
      `${red("error")}: unknown app ${bold(id)}.${hint ? ` Did you mean ${bold(hint)}?` : ""} Run ${bold("react-ui-os list")} to see what is available.`,
    );
  }
  return app;
}

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;

function add(args: Args, registry: Registry): number {
  if (args.positionals.length === 0) {
    console.error(
      `${red("error")}: name at least one app, e.g. ${bold("react-ui-os add notes")}`,
    );
    return 1;
  }

  const cwd = process.cwd();
  const baseDir = resolveBaseDir(args);
  const deps = new Set<string>();
  const added: App[] = [];
  let failed = false;

  for (const id of args.positionals) {
    const app = lookupApp(registry, id);
    if (!app) {
      failed = true;
      continue;
    }

    if (!isSafeId(app.id) || app.files.some((f) => !isSafeRelPath(f.name))) {
      console.error(
        `${red("error")}: app ${bold(app.id)} contains an unsafe path; refusing to install it.`,
      );
      failed = true;
      continue;
    }

    const targetDir = join(cwd, baseDir, app.id);
    const conflicts = app.files
      .map((f) => join(targetDir, f.name))
      .filter((p) => existsSync(p));
    if (conflicts.length > 0 && !args.force) {
      console.error(
        `${red("skip")} ${app.name}: ${conflicts.length} file(s) already exist. Re-run with ${bold("--force")} to overwrite.`,
      );
      for (const c of conflicts) console.error(`  ${dim(toPosix(relative(cwd, c)))}`);
      failed = true;
      continue;
    }

    mkdirSync(targetDir, { recursive: true });
    for (const f of app.files) {
      const target = join(targetDir, f.name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, f.content, "utf8");
    }
    app.dependencies.forEach((d) => deps.add(d));
    added.push(app);

    if (!args.silent) {
      console.log(
        `${green("added")} ${bold(app.name)} ${dim(`→ ${toPosix(join(baseDir, app.id))}`)}`,
      );
      for (const f of app.files)
        console.log(`  ${dim(toPosix(join(baseDir, app.id, f.name)))}`);
    }
  }

  if (added.length > 0 && !args.silent) {
    const installed = installedDeps(cwd);
    const missing = [...deps].filter((d) => !installed.has(d));
    if (missing.length > 0) {
      console.log("");
      console.log(bold("Install dependencies:"));
      console.log(`  ${detectInstallCommand(cwd)} ${missing.join(" ")}`);
    } else if (deps.size > 0) {
      console.log("");
      console.log(dim("All dependencies are already installed."));
    }
    console.log("");
    console.log(bold("Register with the desktop:"));
    for (const app of added) {
      const loc = toPosix(join(baseDir, app.id));
      console.log(`  import { ${cyan(app.export)} } from "./${loc}";`);
    }
    console.log("");
    console.log(
      `  <Desktop apps={[${added.map((a) => cyan(a.export)).join(", ")}]} />`,
    );
  }

  return failed ? 1 : 0;
}

// What you get before you copy it: description, export, dependencies, and the
// files with their sizes.
function info(args: Args, registry: Registry): number {
  if (args.positionals.length === 0) {
    console.error(
      `${red("error")}: name at least one app, e.g. ${bold("react-ui-os info notes")}`,
    );
    return 1;
  }
  let failed = false;
  for (const id of args.positionals) {
    const app = lookupApp(registry, id);
    if (!app) {
      failed = true;
      continue;
    }
    console.log(`${bold(app.name)} ${dim(`(${app.id})`)}`);
    if (app.description) console.log(`  ${app.description}`);
    console.log("");
    if (app.category) console.log(`  ${dim("category")}      ${app.category}`);
    console.log(`  ${dim("export")}        ${cyan(app.export)}`);
    if (app.dependencies.length > 0) {
      console.log(`  ${dim("dependencies")}  ${app.dependencies.join(", ")}`);
    }
    console.log(
      `  ${dim("files")}         ${app.files.length} (${formatSize(
        app.files.reduce((sum, f) => sum + f.content.length, 0),
      )})`,
    );
    for (const f of app.files) {
      console.log(`    ${f.name} ${dim(formatSize(f.content.length))}`);
    }
    console.log("");
    console.log(`${dim("Install it with")} ${bold(`react-ui-os add ${app.id}`)}`);
  }
  return failed ? 1 : 0;
}

function list(registry: Registry): number {
  if (registry.apps.length === 0) {
    console.log("No apps in this registry.");
    return 0;
  }
  console.log(bold(`${registry.name} apps (${registry.apps.length})`));
  const width = Math.max(...registry.apps.map((a) => a.id.length));
  for (const app of registry.apps) {
    console.log(
      `  ${green(app.id.padEnd(width))}  ${app.description} ${dim(`[${app.category}]`)}`,
    );
  }
  console.log("");
  console.log(`${dim("Add one with")} ${bold("react-ui-os add <id>")}`);
  return 0;
}

// Inline a registry's app sources into a single self-contained JSON others can
// host and install from with --registry.
function build(args: Args): number {
  const input = args.positionals[0] ?? "registry.json";
  const out = args.out ?? join("dist", "registry.json");
  let registry: Registry;
  try {
    const raw = parseRawRegistry(readRegistryFile(input), input);
    registry = normalizeRegistry(raw, dirname(resolve(input)));
  } catch (err) {
    console.error(
      `${red("error")}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), JSON.stringify(registry, null, 2) + "\n", "utf8");
  if (!args.silent) {
    console.log(
      `${green("built")} ${registry.apps.length} apps ${dim(`→ ${toPosix(out)}`)}`,
    );
    console.log(
      dim(
        `  host this file and install from it: react-ui-os add <id> --registry <url>`,
      ),
    );
  }
  return 0;
}

function help(): void {
  console.log(`
${bold("react-ui-os")} - install react-ui-os apps into your project

${bold("Usage")}
  react-ui-os <command> [options]

${bold("Commands")}
  add <id...>     Copy one or more apps into your project
  list            List the available apps
  info <id...>    Show an app's files and dependencies before adding it
  build [file]    Inline a registry.json into a self-contained file to host

${bold("Options")}
  -r, --registry <url|path>   Install from another registry instead of the built-in one
  --dir <path>                Target directory (default: src/os-apps, else os-apps)
  -o, --out <path>            Output for build (default: dist/registry.json)
  -f, --force                 Overwrite files that already exist
  -s, --silent                Print errors only
  -h, --help                  Show this help
  -v, --version               Show the version

${bold("Examples")}
  npx @react-ui-os/cli add notes
  npx @react-ui-os/cli list --registry https://acme.com/registry.json
  npx @react-ui-os/cli add weather --registry https://acme.com/registry.json
  npx @react-ui-os/cli build registry.json --out public/registry.json
`);
}

export async function run(argv: string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(
      `${red("error")}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }

  if (args.version) {
    console.log((pkg as { version: string }).version);
    return 0;
  }
  if (args.help || args.command === undefined) {
    help();
    return args.command === undefined && !args.help ? 1 : 0;
  }

  try {
    switch (args.command) {
      case "add":
        return add(args, await resolveRegistry(args));
      case "list":
      case "ls":
        return list(await resolveRegistry(args));
      case "info":
        return info(args, await resolveRegistry(args));
      case "build":
        return build(args);
      default: {
        const hint = closest(args.command, ["add", "list", "info", "build"]);
        console.error(
          `${red("error")}: unknown command ${bold(args.command)}.${hint ? ` Did you mean ${bold(hint)}?` : ""} Run ${bold("react-ui-os --help")}.`,
        );
        return 1;
      }
    }
  } catch (err) {
    console.error(
      `${red("error")}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}
