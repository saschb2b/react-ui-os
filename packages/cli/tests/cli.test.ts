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
});
