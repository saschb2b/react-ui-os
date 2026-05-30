// Guards the hand-authored registry.json against drift. The registry lists
// each app's files explicitly; if an app gains a file and the entry is not
// updated, the distributed app would be missing a module and break on the
// consumer's side after `shadcn add`. These checks fail loudly instead.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}
interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  meta?: { accent?: string };
  files?: RegistryFile[];
}
interface Registry {
  name: string;
  items: RegistryItem[];
}

const registry = JSON.parse(
  readFileSync(resolve(repoRoot, "registry.json"), "utf8"),
) as Registry;

describe("registry.json", () => {
  it("has at least one item", () => {
    expect(registry.items.length).toBeGreaterThan(0);
  });

  for (const item of registry.items) {
    describe(item.name, () => {
      it("has the metadata the gallery and CLI read", () => {
        expect(item.name).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.type).toBe("registry:block");
        expect(item.meta?.accent).toMatch(/^#[0-9a-f]{3,8}$/i);
      });

      it("declares the core and desktop packages as dependencies", () => {
        expect(item.dependencies).toContain("@react-ui-os/core");
        expect(item.dependencies).toContain("@react-ui-os/desktop");
      });

      it("lists files that all exist on disk", () => {
        expect(item.files?.length).toBeGreaterThan(0);
        for (const file of item.files ?? []) {
          expect(
            existsSync(resolve(repoRoot, file.path)),
            `missing source file ${file.path}`,
          ).toBe(true);
        }
      });

      it("keeps every file co-located and targeted under os-apps/<id>", () => {
        for (const file of item.files ?? []) {
          const name = basename(file.path);
          expect(dirname(file.path).replace(/\\/g, "/")).toBe(
            `packages/example-apps/src/${item.name}`,
          );
          expect(file.target).toBe(`@components/os-apps/${item.name}/${name}`);
        }
      });

      it("lists every file in the app folder (no unlisted file)", () => {
        const folder = resolve(
          repoRoot,
          "packages",
          "example-apps",
          "src",
          item.name,
        );
        const onDisk = readdirSync(folder).sort();
        const listed = (item.files ?? []).map((f) => basename(f.path)).sort();
        expect(listed).toEqual(onDisk);
      });
    });
  }
});
