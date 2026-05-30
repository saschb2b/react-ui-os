import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

describe("run", () => {
  it("lists apps and reports success", () => {
    expect(run(["list"])).toBe(0);
  });

  it("prints the version", () => {
    expect(run(["--version"])).toBe(0);
  });

  it("fails on an unknown app", () => {
    expect(run(["add", "bogus"])).toBe(1);
  });

  it("fails when no app is named", () => {
    expect(run(["add"])).toBe(1);
  });

  it("copies an app's files into os-apps and inlines real content", () => {
    expect(run(["add", "notes", "--silent"])).toBe(0);
    const index = join(dir, "os-apps", "notes", "index.tsx");
    expect(existsSync(index)).toBe(true);
    expect(existsSync(join(dir, "os-apps", "notes", "notes-store.ts"))).toBe(true);
    expect(readFileSync(index, "utf8")).toContain("export const notesApp");
  });

  it("refuses to overwrite without --force, then overwrites with it", () => {
    expect(run(["add", "notes", "--silent"])).toBe(0);
    expect(run(["add", "notes", "--silent"])).toBe(1);
    expect(run(["add", "notes", "--silent", "--force"])).toBe(0);
  });

  it("honors --dir", () => {
    expect(run(["add", "clock", "--dir", "widgets", "--silent"])).toBe(0);
    expect(existsSync(join(dir, "widgets", "clock", "index.tsx"))).toBe(true);
  });
});
