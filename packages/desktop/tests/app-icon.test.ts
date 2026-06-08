import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import type { OsTheme } from "@react-ui-os/core";
import { resolveAppIcon } from "../src/util/app-icon";

// Distinct stand-ins; identity is all the resolver cares about.
const DefaultIcon: ComponentType<{ size?: number }> = () => null;
const FluentIcon: ComponentType<{ size?: number }> = () => null;
const GnomeIcon: ComponentType<{ size?: number }> = () => null;

function themeWithStyle(iconStyle?: string): OsTheme {
  return { chrome: { iconStyle } } as unknown as OsTheme;
}

describe("resolveAppIcon", () => {
  it("uses the default icon when the theme requests no style", () => {
    const app = { icon: DefaultIcon, icons: { fluent: FluentIcon } };
    expect(resolveAppIcon(app, themeWithStyle(undefined))).toBe(DefaultIcon);
  });

  it("uses the matching style variant when present", () => {
    const app = { icon: DefaultIcon, icons: { fluent: FluentIcon, gnome: GnomeIcon } };
    expect(resolveAppIcon(app, themeWithStyle("fluent"))).toBe(FluentIcon);
    expect(resolveAppIcon(app, themeWithStyle("gnome"))).toBe(GnomeIcon);
  });

  it("falls back to the default icon when the style has no variant", () => {
    const app = { icon: DefaultIcon, icons: { fluent: FluentIcon } };
    expect(resolveAppIcon(app, themeWithStyle("gnome"))).toBe(DefaultIcon);
  });

  it("returns undefined when the app has no icon at all", () => {
    expect(resolveAppIcon({}, themeWithStyle("fluent"))).toBeUndefined();
  });

  it("falls back to the default when the app provides no variants", () => {
    expect(resolveAppIcon({ icon: DefaultIcon }, themeWithStyle("fluent"))).toBe(
      DefaultIcon,
    );
  });
});
