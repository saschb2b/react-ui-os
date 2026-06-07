import type { App, OsTheme } from "@react-ui-os/core";
import type { ComponentType } from "react";

/**
 * The icon component to render for an app under a given theme. Picks the
 * theme's `chrome.iconStyle` variant from `app.icons` when the app provides
 * one (a Fluent glyph for Windows, say), otherwise the app's default `icon`.
 * Keeps the per-OS icon choice in data, not in a component branching on the
 * theme.
 */
export function resolveAppIcon(
  app: Pick<App, "icon" | "icons">,
  theme: OsTheme,
): ComponentType<{ size?: number }> | undefined {
  const style = theme.chrome.iconStyle;
  return (style ? app.icons?.[style] : undefined) ?? app.icon;
}
