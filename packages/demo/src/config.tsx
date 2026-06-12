"use client";

/**
 * Shared demo configuration for the playground and the docs embed, so the two
 * surfaces stay in sync from one source instead of drifting copies. Everything
 * here is parameterized by `assetBase` ("/" for the playground, "/react-ui-os/"
 * for the docs deploy) since each app serves its own `public/` under a
 * different path.
 */
import type { ComponentType } from "react";
import { useState } from "react";
import type { App, OsTheme } from "@react-ui-os/core";
import { getSystemWindow, registerSystemWindow } from "@react-ui-os/desktop";
import { createMacosTheme } from "@react-ui-os/theme-macos";
import { createUbuntuTheme } from "@react-ui-os/theme-ubuntu";
import { createWindowsTheme } from "@react-ui-os/theme-windows";

export type DemoThemeChoice = "macos" | "windows" | "ubuntu";

const THEME_STORAGE_KEY = "rui-os:playground-theme";

export function isThemeChoice(value: string | null): value is DemoThemeChoice {
  return value === "macos" || value === "windows" || value === "ubuntu";
}

// `?theme=` wins (a shareable deep link), then the visitor's last choice, then macOS.
export function readInitialThemeChoice(): DemoThemeChoice {
  if (typeof window === "undefined") return "macos";
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (isThemeChoice(fromUrl)) return fromUrl;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeChoice(stored)) return stored;
  return "macos";
}

export function persistThemeChoice(choice: DemoThemeChoice): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  const params = new URLSearchParams(window.location.search);
  params.set("theme", choice);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}?${params.toString()}`,
  );
}

function withBase(base: string, path: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${path.replace(/^\//, "")}`;
}

/** A plain image icon (full-color art served from `public/`). */
export function pngIcon(src: string): ComponentType<{ size?: number }> {
  return function PngIcon({ size = 24 }: { size?: number }) {
    return (
      <img src={src} width={size} height={size} alt="" style={{ display: "block" }} />
    );
  };
}

// Probe result per src, shared across every LocalIcon instance: "loaded" once
// the real image has decoded, "failed" once it 404s. The local pack is
// gitignored, so on a clean checkout every src fails; caching that means the
// menu (which renders each app icon in several places at once, and remounts on
// every open) does the 404 once, not on every tile and every open.
const localIconStatus = new Map<string, "loaded" | "failed">();

/**
 * An icon from a local-only (gitignored) pack, with a fallback for when the
 * file is absent, so a clean checkout or the docs deploy degrades gracefully.
 *
 * The fallback shows immediately and the real image loads behind it, swapping
 * in only once it has decoded; a missing pack therefore never flashes a blank
 * tile, just the fallback glyph. The load result is cached per src so the
 * burst of identical icons the launcher renders, and every later open, render
 * the right thing at once instead of re-fetching.
 */
export function localIcon(
  src: string,
  Fallback?: ComponentType<{ size?: number }>,
): ComponentType<{ size?: number }> {
  // Warm the cache the moment the icon is declared (module load, well before
  // Start is first opened) so the first render usually already knows the
  // result and shows the real image straight away rather than the fallback.
  // Guarded for SSR; the result is shared through localIconStatus.
  if (typeof window !== "undefined" && !localIconStatus.has(src)) {
    const probe = new window.Image();
    probe.onload = () => localIconStatus.set(src, "loaded");
    probe.onerror = () => localIconStatus.set(src, "failed");
    probe.src = src;
  }
  return function LocalIcon({ size = 24 }: { size?: number }) {
    const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
      () => localIconStatus.get(src) ?? "loading",
    );

    // Known missing: just the fallback, no <img>, no request.
    if (status === "failed") {
      return Fallback ? <Fallback size={size} /> : null;
    }

    const img = (
      <img
        src={src}
        width={size}
        height={size}
        alt=""
        decoding="async"
        onLoad={() => {
          localIconStatus.set(src, "loaded");
          setStatus("loaded");
        }}
        onError={() => {
          localIconStatus.set(src, "failed");
          setStatus("failed");
        }}
        style={{ display: "block" }}
      />
    );

    // Cached as loaded: the browser has it, so render it straight (instant).
    if (status === "loaded") return img;

    // First probe: show the fallback glyph with the loading image stacked
    // invisibly over it, so there is never a blank gap. The image reveals
    // itself by switching to the "loaded" branch above once it decodes; if it
    // 404s instead, the "failed" branch keeps the fallback.
    return (
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          width: size,
          height: size,
        }}
      >
        {Fallback ? <Fallback size={size} /> : null}
        <span style={{ position: "absolute", inset: 0, opacity: 0 }}>{img}</span>
      </span>
    );
  };
}

// App ids that have a committed Yaru (gnome) icon and a Windows-11 (fluent) icon.
const ICON_IDS = [
  "hello",
  "notes",
  "calculator",
  "clock",
  "calendar",
  "reminders",
  "sketch",
  "terminal",
];

/**
 * Add the per-theme icons every demo app shares: Ubuntu's Yaru art (committed)
 * for the `gnome` style, and the real Windows 11 pack for `fluent` (from the
 * gitignored `public/local/win11/` slot; falls back to the bundled MIT Fluent
 * glyph when the pack is absent). macOS keeps each app's default glyph.
 */
export function applyDemoIcons(apps: App[], assetBase: string): App[] {
  return apps.map((app) => {
    if (!ICON_IDS.includes(app.id)) return app;
    return {
      ...app,
      icons: {
        ...app.icons,
        gnome: pngIcon(withBase(assetBase, `yaru/${app.id}.png`)),
        fluent: localIcon(
          withBase(assetBase, `local/win11/${app.id}.png`),
          app.icons?.fluent,
        ),
      },
    };
  });
}

/** The wallpaper gallery offered in Settings > Appearance. */
export function demoWallpapers(assetBase: string): { src: string; label: string }[] {
  return [
    { src: withBase(assetBase, "macos-wallpaper.jpg"), label: "Tahoe Day" },
    { src: withBase(assetBase, "macos-wallpaper-dark.jpg"), label: "Tahoe Dark" },
    { src: withBase(assetBase, "windows-wallpaper.jpg"), label: "Bloom Light" },
    { src: withBase(assetBase, "windows-wallpaper-dark.jpg"), label: "Bloom Dark" },
    { src: withBase(assetBase, "ubuntu-wallpaper.png"), label: "Resolute Raccoon" },
    {
      src: withBase(assetBase, "ubuntu-wallpaper-dark.png"),
      label: "Resolute Raccoon Dark",
    },
  ];
}

/** Build the OsTheme for a chosen platform, with assets resolved under `assetBase`. */
export function buildDemoTheme(choice: DemoThemeChoice, assetBase: string): OsTheme {
  const wallpaperOptions = demoWallpapers(assetBase);
  if (choice === "windows") {
    return createWindowsTheme({
      wallpaperSrc: withBase(assetBase, "windows-wallpaper.jpg"),
      darkWallpaperSrc: withBase(assetBase, "windows-wallpaper-dark.jpg"),
      wallpaperOptions,
    });
  }
  if (choice === "ubuntu") {
    return createUbuntuTheme({
      wallpaperSrc: withBase(assetBase, "ubuntu-wallpaper-dark.png"),
      lightWallpaperSrc: withBase(assetBase, "ubuntu-wallpaper.png"),
      wallpaperOptions,
      launcherIconSrc: withBase(assetBase, "yaru/show-apps.svg"),
    });
  }
  return createMacosTheme({
    wallpaperSrc: withBase(assetBase, "macos-wallpaper.jpg"),
    darkWallpaperSrc: withBase(assetBase, "macos-wallpaper-dark.jpg"),
    wallpaperOptions,
    liquidGlass: true,
  });
}

/** Give the built-in Settings window its per-theme icons (gnome + fluent). */
export function applyDemoSettingsIcon(assetBase: string): void {
  const def = getSystemWindow("settings");
  if (!def) return;
  registerSystemWindow("settings", {
    ...def,
    icons: {
      ...def.icons,
      gnome: pngIcon(withBase(assetBase, "yaru/settings.png")),
      fluent: localIcon(
        withBase(assetBase, "local/win11/settings.png"),
        def.icons?.fluent,
      ),
    },
  });
}
