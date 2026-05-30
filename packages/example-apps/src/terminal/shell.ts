/**
 * Pure command shell for the Terminal app. No React, no DOM: the command
 * registry and the in-memory fake filesystem live here so the logic is
 * unit-testable and decoupled from rendering.
 *
 * Conventions are taken from bash/zsh and macOS Terminal:
 *  - Unknown commands print `<name>: command not found` (bash's wording;
 *    zsh prints `command not found: <name>`). We follow bash here:
 *    https://www.gnu.org/software/bash/manual/bash.html (Bash error messages)
 *  - `ls` lists directory entries; a trailing `/` marks subdirectories,
 *    matching `ls -F` / Finder column conventions.
 *  - `cat <file>` prints file contents; a missing path prints
 *    `cat: <path>: No such file or directory` (coreutils wording).
 *  - `pwd` prints the working directory; `whoami` prints the user name.
 */

/** A node in the fake filesystem: either a directory (map) or a file (string). */
export type FsNode = { type: "dir"; children: Record<string, FsNode> } | { type: "file"; content: string };

export interface ShellEnv {
  /** Resolved home / working directory shown by `pwd`. */
  cwd: string;
  /** Name reported by `whoami` and used in the prompt. */
  user: string;
  /** Read-only command history (oldest first). The shell never mutates it. */
  history: readonly string[];
}

/**
 * A side effect the renderer must carry out. The pure shell cannot touch the
 * scrollback or the window manager, so it returns an intent and the component
 * acts on it.
 */
export type ShellSignal =
  | { type: "none" }
  | { type: "clear" }
  | { type: "open"; appId: string };

export interface CommandResult {
  /** Output lines printed below the command. Empty array prints nothing. */
  output: string[];
  /** Side effect for the renderer (clearing scrollback, opening an app). */
  signal: ShellSignal;
}

export interface CommandContext {
  env: ShellEnv;
  /** Ids of apps that `open` may launch, supplied by the renderer. */
  openableAppIds: readonly string[];
  /** Human labels for openable apps, keyed by id, for the `open` listing. */
  appLabels: Readonly<Record<string, string>>;
}

interface CommandDef {
  summary: string;
  /** Usage hint shown by `help`, e.g. `echo <text>`. */
  usage: string;
  run: (args: string[], ctx: CommandContext) => CommandResult;
}

const ABOUT_LINE =
  "react-ui-os: a React component library that ships a working OS-style desktop. Apps are data, themes are token bags.";

/**
 * The fake filesystem. A small home tree with a couple of directories and
 * files so `ls` and `cat` have something real to read. Kept flat and shallow
 * on purpose: this is a showcase shell, not a VFS.
 */
export function createFileSystem(): FsNode {
  return {
    type: "dir",
    children: {
      Desktop: { type: "dir", children: {} },
      Documents: {
        type: "dir",
        children: {
          "readme.txt": {
            type: "file",
            content: "Welcome to the react-ui-os terminal.\nTry: help, ls, cat Documents/notes.md, open calculator.",
          },
          "notes.md": {
            type: "file",
            content: "# Notes\n- Windows are first-class, URLs are downstream.\n- Apps are data, themes are token bags.",
          },
        },
      },
      Downloads: { type: "dir", children: {} },
      ".profile": {
        type: "file",
        content: "# Loaded at shell start. Edit your prompt and aliases here.",
      },
    },
  };
}

/** A single shared filesystem instance for the running shell session. */
const FILE_SYSTEM = createFileSystem();

/**
 * Resolve a slash-separated path against the filesystem root. Leading and
 * trailing slashes are tolerated; empty / "." paths resolve to the root.
 * Returns null when any segment is missing.
 */
export function resolvePath(root: FsNode, path: string): FsNode | null {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "/" || trimmed === "~") return root;
  const segments = trimmed.replace(/^[~/]+/, "").split("/").filter((s) => s.length > 0 && s !== ".");
  let node: FsNode = root;
  for (const segment of segments) {
    if (node.type !== "dir") return null;
    const next = node.children[segment];
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Directory listing with a trailing slash on subdirectories (ls -F style). */
function listDir(node: Extract<FsNode, { type: "dir" }>): string[] {
  return Object.entries(node.children)
    .filter(([name]) => !name.startsWith(".")) // dotfiles hidden unless `ls -a`; we keep it simple
    .map(([name, child]) => (child.type === "dir" ? `${name}/` : name))
    .sort((a, b) => a.localeCompare(b));
}

const COMMANDS: Record<string, CommandDef> = {
  help: {
    summary: "List available commands.",
    usage: "help",
    run: () => {
      const defs = Object.values(COMMANDS).sort((a, b) => a.usage.localeCompare(b.usage));
      const width = Math.max(...defs.map((d) => d.usage.length));
      const lines = defs.map((d) => `  ${d.usage.padEnd(width)}  ${d.summary}`);
      return { output: ["Available commands:", ...lines], signal: { type: "none" } };
    },
  },
  echo: {
    summary: "Print the given text.",
    usage: "echo <text>",
    run: (args) => ({ output: [args.join(" ")], signal: { type: "none" } }),
  },
  date: {
    summary: "Print the current date and time.",
    usage: "date",
    // Mirrors the default `date` format: "Fri May 30 14:03:21 2026".
    run: () => ({ output: [new Date().toString()], signal: { type: "none" } }),
  },
  whoami: {
    summary: "Print the current user.",
    usage: "whoami",
    run: (_args, ctx) => ({ output: [ctx.env.user], signal: { type: "none" } }),
  },
  pwd: {
    summary: "Print the working directory.",
    usage: "pwd",
    run: (_args, ctx) => ({ output: [ctx.env.cwd], signal: { type: "none" } }),
  },
  ls: {
    summary: "List directory contents.",
    usage: "ls [path]",
    run: (args) => {
      const path = args[0] ?? "";
      const node = resolvePath(FILE_SYSTEM, path);
      if (!node) {
        return { output: [`ls: ${path || "."}: No such file or directory`], signal: { type: "none" } };
      }
      if (node.type === "file") {
        // `ls <file>` echoes the path back, matching coreutils.
        return { output: [path], signal: { type: "none" } };
      }
      const entries = listDir(node);
      return { output: entries.length > 0 ? [entries.join("  ")] : [], signal: { type: "none" } };
    },
  },
  cat: {
    summary: "Print a file's contents.",
    usage: "cat <file>",
    run: (args) => {
      const path = args[0];
      if (!path) return { output: ["cat: missing file operand"], signal: { type: "none" } };
      const node = resolvePath(FILE_SYSTEM, path);
      if (!node) {
        return { output: [`cat: ${path}: No such file or directory`], signal: { type: "none" } };
      }
      if (node.type === "dir") {
        return { output: [`cat: ${path}: Is a directory`], signal: { type: "none" } };
      }
      return { output: node.content.split("\n"), signal: { type: "none" } };
    },
  },
  clear: {
    summary: "Clear the scrollback.",
    usage: "clear",
    run: () => ({ output: [], signal: { type: "clear" } }),
  },
  history: {
    summary: "Show command history.",
    usage: "history",
    // Numbered, right-aligned index, matching the bash `history` builtin.
    run: (_args, ctx) => {
      const entries = ctx.env.history;
      const width = String(entries.length).length;
      return {
        output: entries.map((cmd, i) => `${String(i + 1).padStart(width)}  ${cmd}`),
        signal: { type: "none" },
      };
    },
  },
  about: {
    summary: "About react-ui-os.",
    usage: "about",
    run: () => ({ output: [ABOUT_LINE], signal: { type: "none" } }),
  },
  open: {
    summary: "Open a desktop app by id.",
    usage: "open <appId>",
    run: (args, ctx) => {
      const appId = args[0];
      const listing = (): string[] => {
        if (ctx.openableAppIds.length === 0) return ["open: no apps available"];
        const width = Math.max(...ctx.openableAppIds.map((id) => id.length));
        return [
          "Open one of:",
          ...ctx.openableAppIds
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((id) => `  ${id.padEnd(width)}  ${ctx.appLabels[id] ?? ""}`.trimEnd()),
        ];
      };
      if (!appId) return { output: listing(), signal: { type: "none" } };
      if (!ctx.openableAppIds.includes(appId)) {
        return { output: [`open: ${appId}: no such app`, ...listing()], signal: { type: "none" } };
      }
      const label = ctx.appLabels[appId] ?? appId;
      return { output: [`Opening ${label}…`], signal: { type: "open", appId } };
    },
  },
};

/** Command names known to the shell, sorted for help and tab completion. */
export function commandNames(): string[] {
  return Object.keys(COMMANDS).sort((a, b) => a.localeCompare(b));
}

/**
 * Tab-completion candidates for a partial first word. Returns the full set of
 * command names that start with the prefix (empty array when none match).
 */
export function completeCommand(prefix: string): string[] {
  if (prefix.length === 0) return [];
  return commandNames().filter((name) => name.startsWith(prefix));
}

/**
 * Run a raw input line. Splits on whitespace, dispatches the first word as the
 * command, and passes the rest as args. An empty line is a no-op (no output),
 * matching a real shell. An unknown command prints bash's "command not found".
 */
export function runCommand(line: string, ctx: CommandContext): CommandResult {
  const trimmed = line.trim();
  if (trimmed === "") return { output: [], signal: { type: "none" } };
  const words = trimmed.split(/\s+/);
  const name = words[0] ?? "";
  const args = words.slice(1);
  const command = COMMANDS[name];
  if (!command) {
    return { output: [`${name}: command not found`], signal: { type: "none" } };
  }
  return command.run(args, ctx);
}
