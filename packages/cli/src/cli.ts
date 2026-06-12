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
  description: string;
  category: string;
  accent: string;
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
    description: app.description,
    category: app.category,
    accent: app.accent,
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

async function loadRegistry(source: string): Promise<Registry> {
  let text: string;
  if (isUrl(source)) {
    const res = await globalThis.fetch(source);
    if (!res.ok) {
      throw new Error(`could not fetch registry from ${source} (${res.status})`);
    }
    text = await res.text();
  } else {
    text = readFileSync(resolve(source), "utf8");
  }
  const raw = JSON.parse(text) as RawRegistry;
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
    const app = registry.apps.find((a) => a.id === id);
    if (!app) {
      console.error(
        `${red("error")}: unknown app ${bold(id)}. Run ${bold("react-ui-os list")} to see what is available.`,
      );
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
    console.log("");
    console.log(bold("Install dependencies:"));
    console.log(`  npm install ${[...deps].join(" ")}`);
    console.log("");
    console.log(bold("Register with the desktop:"));
    for (const app of added) {
      const loc = toPosix(join(baseDir, app.id));
      console.log(
        `  ${app.name}: import ${cyan(app.export)} from ${dim(loc)}, then add it to ${dim("<Desktop apps={[...]} />")}`,
      );
    }
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
    const raw = JSON.parse(readFileSync(resolve(input), "utf8")) as RawRegistry;
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
      case "build":
        return build(args);
      default:
        console.error(
          `${red("error")}: unknown command ${bold(args.command)}. Run ${bold("react-ui-os --help")}.`,
        );
        return 1;
    }
  } catch (err) {
    console.error(
      `${red("error")}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}
