import { useEffect, useMemo, useState } from "react";
import type { OsTheme } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import { notify, useWindowManager } from "@react-ui-os/core";
import type { WindowPayload } from "@react-ui-os/core";
import { createMacosTheme } from "@react-ui-os/theme-macos";
import { createUbuntuTheme } from "@react-ui-os/theme-ubuntu";
import { createWindowsTheme } from "@react-ui-os/theme-windows";
import { docsApps } from "./apps";
import {
  NOTIFICATION_CENTER_TOGGLE_EVENT,
  SPOTLIGHT_OPEN_EVENT,
  pickInitialBounds,
  useApps,
  useTheme,
} from "@react-ui-os/desktop";
import { DocsSpotlightSource } from "./DocsSpotlightSource";
import { ThemeSwitcher, type ThemeChoice } from "./ThemeSwitcher";
import { UbuntuQuickSettings } from "./UbuntuQuickSettings";

const THEME_STORAGE_KEY = "rui-os:playground-theme";

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "macos" || value === "windows" || value === "ubuntu";
}

// `?theme=` wins (an explicit, shareable deep link), then the last choice the
// visitor made, then macOS, the look the docs lead with.
function readInitialThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "macos";
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (isThemeChoice(fromUrl)) return fromUrl;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeChoice(stored)) return stored;
  return "macos";
}

function persistThemeChoice(choice: ThemeChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  // Mirror the choice into the URL so the current view stays shareable
  // without forcing a reload.
  const params = new URLSearchParams(window.location.search);
  params.set("theme", choice);
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

// Prefix the configured base path (e.g. "/react-ui-os/" on GitHub Pages). A
// bare relative wallpaper path would resolve against the current page URL and
// 404 on a sub-path deploy.
function assetBase(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

function buildTheme(choice: ThemeChoice): OsTheme {
  const base = assetBase();
  // The bundled wallpapers, offered as a gallery in Settings > Appearance.
  const wallpaperOptions = [
    { src: `${base}macos-wallpaper.jpg`, label: "Tahoe Day" },
    { src: `${base}macos-wallpaper-dark.jpg`, label: "Tahoe Dark" },
    { src: `${base}windows-wallpaper.jpg`, label: "Bloom Light" },
    { src: `${base}windows-wallpaper-dark.jpg`, label: "Bloom Dark" },
    { src: `${base}ubuntu-wallpaper.png`, label: "Yaru" },
  ];
  if (choice === "windows") {
    return createWindowsTheme({
      wallpaperSrc: `${base}windows-wallpaper.jpg`,
      darkWallpaperSrc: `${base}windows-wallpaper-dark.jpg`,
      wallpaperOptions,
    });
  }
  if (choice === "ubuntu") {
    return createUbuntuTheme({
      wallpaperSrc: `${base}ubuntu-wallpaper-dark.png`,
      lightWallpaperSrc: `${base}ubuntu-wallpaper.png`,
      wallpaperOptions,
      // The real Yaru Show Applications glyph (recolored to the foreground).
      launcherIconSrc: `${base}yaru/show-apps.svg`,
    });
  }
  return createMacosTheme({
    wallpaperSrc: `${base}macos-wallpaper.jpg`,
    darkWallpaperSrc: `${base}macos-wallpaper-dark.jpg`,
    wallpaperOptions,
    // Tahoe Liquid Glass refraction where supported (Chromium); blur fallback.
    liquidGlass: true,
  });
}

/**
 * Deep-link the playground from a docs LivePreview. `?demo=<key>` opens
 * the matching feature on boot. Used by component pages that want to
 * point at one thing instead of the full catch-all desktop.
 *
 * Recognized demo keys:
 *
 *   spotlight    Opens Spotlight via the shared event.
 *   settings     Opens the Settings system window.
 *   window       Opens the Hello app so the reader sees a window to drag.
 *   dock         Opens all three apps so the indicator dots are visible.
 *   menubar      Opens Hello so the menu bar shows a focused name.
 *   recents      Pre-seeds a few Recents entries and opens the folder
 *                so the FileExplorer is populated.
 *   notifications  Fires four representative toasts so the reader sees
 *                  the stack + dock badges + menu-bar dot at once.
 *   notification-center  Same toasts, then opens the Center sheet.
 */
function DemoActivator() {
  const { openWindow } = useWindowManager();
  const theme = useTheme();
  const apps = useApps();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo");
    if (!demo) return;

    // Open windows the way every built-in surface does: centered and clamped
    // to the work area via pickInitialBounds. The bare openWindow(payload)
    // would fall back to a fixed 720x480 default that overflows this iframe.
    const open = (payload: WindowPayload) =>
      openWindow(payload, pickInitialBounds(payload, theme, apps));

    const t = window.setTimeout(() => {
      switch (demo) {
        case "spotlight":
          window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT));
          break;
        case "settings":
          open({ kind: "system", systemId: "settings" });
          break;
        case "window":
        case "menubar":
          open({ kind: "app", appId: "hello" });
          break;
        case "dock":
          open({ kind: "app", appId: "hello" });
          open({ kind: "app", appId: "notes" });
          open({ kind: "app", appId: "calculator" });
          break;
        case "notifications":
        case "notification-center": {
          notify({
            title: "Build finished",
            body: "Deploy succeeded in 1m 42s.",
            appId: "hello",
            level: "success",
            actions: [
              { label: "View", onClick: () => {}, primary: true },
              { label: "Dismiss", onClick: () => {} },
            ],
          });
          notify({
            title: "Sync paused",
            body: "Pending changes will resume when you're back online.",
            appId: "notes",
            level: "warn",
          });
          notify({
            title: "New message",
            body: "Alex sent you a draft to review.",
            appId: "calculator",
          });
          notify({
            title: "Disk almost full",
            body: "You have 200 MB free on your primary volume.",
            level: "error",
          });
          if (demo === "notification-center") {
            window.setTimeout(() => {
              window.dispatchEvent(new CustomEvent(NOTIFICATION_CENTER_TOGGLE_EVENT));
            }, 400);
          }
          break;
        }
        case "recents": {
          const now = Date.now();
          const items = [
            {
              id: "demo-1",
              name: "Sketch.txt",
              kind: "txt",
              createdAt: now - 5 * 60000,
            },
            {
              id: "demo-2",
              name: "Recipe.md",
              kind: "md",
              createdAt: now - 30 * 60000,
            },
            {
              id: "demo-3",
              name: "Bookmark",
              kind: "url",
              createdAt: now - 60 * 60000,
            },
            { id: "demo-4", name: "Idea.md", kind: "md", createdAt: now - 90 * 60000 },
          ];
          window.localStorage.setItem("rui-os:recents", JSON.stringify(items));
          window.dispatchEvent(
            new CustomEvent("react-ui-os:storage-changed", {
              detail: { key: "recents" },
            }),
          );
          window.setTimeout(() => {
            open({ kind: "system", systemId: "recents" });
          }, 80);
          break;
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(t);
    };
  }, [openWindow, theme, apps]);

  return null;
}

/**
 * Client-only React island that boots the desktop. Boots in the chosen theme
 * (macOS by default), mounts the on-canvas ThemeSwitcher so a visitor can
 * swap the whole look with a click, and mounts a small invisible activator
 * that reads `?demo=` and opens the matching surface on boot. The activator
 * sits inside the same provider so it can dispatch openWindow.
 */
export default function PlaygroundDesktop() {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readInitialThemeChoice);
  const theme = useMemo<OsTheme>(() => buildTheme(themeChoice), [themeChoice]);

  const handleThemeChange = (choice: ThemeChoice) => {
    setThemeChoice(choice);
    persistThemeChoice(choice);
  };

  return (
    <Desktop apps={docsApps} theme={theme}>
      <DemoActivator />
      <DocsSpotlightSource />
      {themeChoice === "ubuntu" && <UbuntuQuickSettings />}
      <ThemeSwitcher value={themeChoice} onChange={handleThemeChange} />
    </Desktop>
  );
}
