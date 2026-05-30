import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import appsData from "./apps.data.json";
import pkg from "../package.json";

interface AppFile {
  name: string;
  content: string;
}

interface AppEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  export: string;
  dependencies: string[];
  files: AppFile[];
}

interface AppsData {
  name: string;
  homepage: string;
  apps: AppEntry[];
}

const data = appsData as unknown as AppsData;
const apps = data.apps;

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
    else if (a.startsWith("-"))
      throw new Error(`Unknown option: ${a}. Run with --help.`);
    else if (args.command === undefined) args.command = a;
    else args.positionals.push(a);
  }
  return args;
}

// Default landing spot: a project that keeps source in src/ gets src/os-apps,
// otherwise os-apps at the project root. --dir overrides either way.
function resolveBaseDir(args: Args): string {
  if (args.dir) return args.dir;
  return existsSync(join(process.cwd(), "src")) ? join("src", "os-apps") : "os-apps";
}

const toPosix = (p: string) => p.split(/[\\/]/).join("/");

function add(args: Args): number {
  if (args.positionals.length === 0) {
    console.error(
      `${red("error")}: name at least one app, e.g. ${bold("react-ui-os add notes")}`,
    );
    return 1;
  }

  const cwd = process.cwd();
  const baseDir = resolveBaseDir(args);
  const deps = new Set<string>();
  const added: AppEntry[] = [];
  let failed = false;

  for (const id of args.positionals) {
    const app = apps.find((a) => a.id === id);
    if (!app) {
      console.error(
        `${red("error")}: unknown app ${bold(id)}. Run ${bold("react-ui-os list")} to see what is available.`,
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
    for (const f of app.files)
      writeFileSync(join(targetDir, f.name), f.content, "utf8");
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

function list(): number {
  console.log(bold(`react-ui-os apps (${apps.length})`));
  const width = Math.max(...apps.map((a) => a.id.length));
  for (const app of apps) {
    console.log(
      `  ${green(app.id.padEnd(width))}  ${app.description} ${dim(`[${app.category}]`)}`,
    );
  }
  console.log("");
  console.log(`${dim("Add one with")} ${bold("react-ui-os add <id>")}`);
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

${bold("Options")}
  --dir <path>    Target directory (default: src/os-apps, else os-apps)
  -f, --force     Overwrite files that already exist
  -s, --silent    Print errors only
  -h, --help      Show this help
  -v, --version   Show the version

${bold("Examples")}
  npx @react-ui-os/cli add notes
  npx @react-ui-os/cli add calculator clock --dir app/desktop-apps
  npx @react-ui-os/cli list
`);
}

export function run(argv: string[]): number {
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

  switch (args.command) {
    case "add":
      return add(args);
    case "list":
    case "ls":
      return list();
    default:
      console.error(
        `${red("error")}: unknown command ${bold(args.command)}. Run ${bold("react-ui-os --help")}.`,
      );
      return 1;
  }
}
