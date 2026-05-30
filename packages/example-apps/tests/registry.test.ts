// Guards the hand-authored registry.json against drift. The manifest lists
// each app's files explicitly and the CLI bundles them by that list; if an app
// gains a file and the entry is not updated, the CLI would copy an app with a
// missing module that breaks on the consumer's side. These checks fail instead.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface AppEntry {
  id: string;
  name: string;
  description?: string;
  category?: string;
  accent?: string;
  export?: string;
  dependencies?: string[];
  dir?: string;
  files?: string[];
}
interface Registry {
  name: string;
  apps: AppEntry[];
}

const registry = JSON.parse(
  readFileSync(resolve(repoRoot, "registry.json"), "utf8"),
) as Registry;

describe("registry.json", () => {
  it("has at least one app", () => {
    expect(registry.apps.length).toBeGreaterThan(0);
  });

  for (const app of registry.apps) {
    describe(app.id, () => {
      it("has the metadata the gallery and CLI read", () => {
        expect(app.id).toBeTruthy();
        expect(app.name).toBeTruthy();
        expect(app.description).toBeTruthy();
        expect(app.category).toBeTruthy();
        expect(app.export).toBeTruthy();
        expect(app.accent).toMatch(/^#[0-9a-f]{3,8}$/i);
      });

      it("declares the core and desktop packages as dependencies", () => {
        expect(app.dependencies).toContain("@react-ui-os/core");
        expect(app.dependencies).toContain("@react-ui-os/desktop");
      });

      it("points at a real source directory and a non-empty file list", () => {
        expect(app.dir).toBeTruthy();
        expect(existsSync(resolve(repoRoot, app.dir ?? ""))).toBe(true);
        expect(app.files?.length).toBeGreaterThan(0);
      });

      it("lists basenames only, each present on disk", () => {
        for (const file of app.files ?? []) {
          expect(basename(file)).toBe(file);
          expect(
            existsSync(resolve(repoRoot, app.dir ?? "", file)),
            `missing source file ${app.dir}/${file}`,
          ).toBe(true);
        }
      });

      it("lists every file in the app folder (no unlisted file)", () => {
        const onDisk = readdirSync(resolve(repoRoot, app.dir ?? "")).sort();
        const listed = [...(app.files ?? [])].sort();
        expect(listed).toEqual(onDisk);
      });
    });
  }
});
