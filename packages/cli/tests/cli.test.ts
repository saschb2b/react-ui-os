import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/cli";

const origCwd = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rui-cli-"));
  process.chdir(dir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(origCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("run (built-in registry)", () => {
  it("lists apps and reports success", async () => {
    expect(await run(["list"])).toBe(0);
  });

  it("prints the version", async () => {
    expect(await run(["--version"])).toBe(0);
  });

  it("fails on an unknown app", async () => {
    expect(await run(["add", "bogus"])).toBe(1);
  });

  it("suggests the closest id on a typo", async () => {
    expect(await run(["add", "nots"])).toBe(1);
    const err = vi
      .mocked(console.error)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(err).toContain("Did you mean");
    expect(err).toContain("notes");
  });

  it("suggests the closest command on a typo", async () => {
    expect(await run(["ad", "notes"])).toBe(1);
    const err = vi
      .mocked(console.error)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(err).toContain("Did you mean");
    expect(err).toContain("add");
  });

  it("fails when no app is named", async () => {
    expect(await run(["add"])).toBe(1);
  });

  it("copies an app's files into os-apps and inlines real content", async () => {
    expect(await run(["add", "notes", "--silent"])).toBe(0);
    const index = join(dir, "os-apps", "notes", "index.tsx");
    expect(existsSync(index)).toBe(true);
    expect(existsSync(join(dir, "os-apps", "notes", "notes-store.ts"))).toBe(true);
    expect(readFileSync(index, "utf8")).toContain("export const notesApp");
  });

  it("refuses to overwrite without --force, then overwrites with it", async () => {
    expect(await run(["add", "notes", "--silent"])).toBe(0);
    expect(await run(["add", "notes", "--silent"])).toBe(1);
    expect(await run(["add", "notes", "--silent", "--force"])).toBe(0);
  });

  it("honors --dir", async () => {
    expect(await run(["add", "clock", "--dir", "widgets", "--silent"])).toBe(0);
    expect(existsSync(join(dir, "widgets", "clock", "index.tsx"))).toBe(true);
  });

  it("matches the install hint to the project's package manager", async () => {
    writeFileSync(join(dir, "pnpm-lock.yaml"), "", "utf8");
    expect(await run(["add", "notes"])).toBe(0);
    const out = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(out).toContain("pnpm add @react-ui-os/core");
  });

  it("prefers the packageManager field over lockfiles", async () => {
    writeFileSync(join(dir, "yarn.lock"), "", "utf8");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ packageManager: "bun@1.2.0" }),
      "utf8",
    );
    expect(await run(["add", "notes"])).toBe(0);
    const out = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(out).toContain("bun add @react-ui-os/core");
  });

  it("prints a copy-pasteable named-import register snippet", async () => {
    expect(await run(["add", "notes"])).toBe(0);
    const out = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join("\n")
      // eslint-disable-next-line no-control-regex
      .replace(/\[\d+m/g, "");
    expect(out).toContain('import { notesApp } from "./os-apps/notes";');
    expect(out).toContain("<Desktop apps={[notesApp]} />");
  });
});

// A third-party registry: an authoring registry.json plus its app source. The
// build command inlines it; --registry installs from either the authoring file
// (local, reads `dir`) or the built file (self-contained).
function seedThirdPartyRegistry(root: string): string {
  const appDir = join(root, "apps", "weather");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(
    join(appDir, "index.tsx"),
    'export const weatherApp = { id: "weather" };\n',
    "utf8",
  );
  const manifest = {
    name: "acme",
    apps: [
      {
        id: "weather",
        name: "Weather",
        description: "Today at a glance.",
        category: "utilities",
        accent: "#38bdf8",
        export: "weatherApp",
        dependencies: ["@react-ui-os/core", "@react-ui-os/desktop"],
        dir: "apps/weather",
        files: ["index.tsx"],
      },
    ],
  };
  const manifestPath = join(root, "registry.json");
  writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
  return manifestPath;
}

describe("third-party registries", () => {
  it("installs directly from a local authoring registry", async () => {
    const manifest = seedThirdPartyRegistry(dir);
    expect(await run(["add", "weather", "--registry", manifest, "--silent"])).toBe(0);
    expect(existsSync(join(dir, "os-apps", "weather", "index.tsx"))).toBe(true);
  });

  it("builds a self-contained registry and installs from it", async () => {
    const manifest = seedThirdPartyRegistry(dir);
    const built = join(dir, "out", "registry.json");
    expect(await run(["build", manifest, "--out", built, "--silent"])).toBe(0);

    const json = JSON.parse(readFileSync(built, "utf8"));
    expect(json.apps[0].files[0].content).toContain("weatherApp");

    expect(
      await run(["add", "weather", "--registry", built, "--dir", "x", "--silent"]),
    ).toBe(0);
    expect(existsSync(join(dir, "x", "weather", "index.tsx"))).toBe(true);
  });

  it("lists the apps in another registry", async () => {
    const manifest = seedThirdPartyRegistry(dir);
    expect(await run(["list", "--registry", manifest])).toBe(0);
  });

  it("supports file names that nest into subdirectories", async () => {
    const manifest = join(dir, "registry.json");
    writeFileSync(
      manifest,
      JSON.stringify({
        name: "acme",
        apps: [
          {
            id: "nested",
            name: "Nested",
            description: "x",
            category: "x",
            accent: "#fff",
            export: "nestedApp",
            files: [
              { name: "index.tsx", content: "export const nestedApp = 1;\n" },
              { name: "components/Panel.tsx", content: "export const p = 1;\n" },
            ],
          },
        ],
      }),
      "utf8",
    );
    expect(await run(["add", "nested", "--registry", manifest, "--silent"])).toBe(0);
    expect(
      existsSync(join(dir, "os-apps", "nested", "components", "Panel.tsx")),
    ).toBe(true);
  });

  it("refuses ids and file names that escape the target directory", async () => {
    const evil = (id: string, fileName: string) => ({
      name: "evil",
      apps: [
        {
          id,
          name: "Evil",
          description: "x",
          category: "x",
          accent: "#fff",
          export: "evilApp",
          files: [{ name: fileName, content: "owned\n" }],
        },
      ],
    });
    const manifest = join(dir, "registry.json");

    writeFileSync(manifest, JSON.stringify(evil("good", "../../escape.txt")), "utf8");
    expect(await run(["add", "good", "--registry", manifest, "--silent"])).toBe(1);
    expect(existsSync(join(dir, "escape.txt"))).toBe(false);

    writeFileSync(manifest, JSON.stringify(evil("..", "index.tsx")), "utf8");
    expect(await run(["add", "..", "--registry", manifest, "--silent"])).toBe(1);
    expect(existsSync(join(dir, "os-apps", "index.tsx"))).toBe(false);

    writeFileSync(
      manifest,
      JSON.stringify(evil("good", "C:\\Windows\\Temp\\escape.txt")),
      "utf8",
    );
    expect(await run(["add", "good", "--registry", manifest, "--silent"])).toBe(1);
  });
});
