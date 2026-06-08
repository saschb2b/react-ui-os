import { describe, expect, it } from "vitest";
import { exampleApps } from "../src";

// The example apps are the reference set, so each should carry a default icon
// and a Windows (Fluent) variant; the per-theme dock resolves the latter under
// the Windows theme. A new app missing one would silently fall back to a letter.
describe("example app icons", () => {
  it("ships seven apps", () => {
    expect(exampleApps).toHaveLength(7);
  });

  for (const app of exampleApps) {
    describe(app.id, () => {
      it("has a default icon component", () => {
        expect(app.icon).toBeTypeOf("function");
      });
      it("has a Fluent (Windows) icon variant", () => {
        expect(app.icons?.fluent).toBeTypeOf("function");
      });
    });
  }
});
