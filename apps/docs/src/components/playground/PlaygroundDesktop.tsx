import { useEffect, useMemo } from "react";
import type { OsTheme } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import { notify, useWindowManager } from "@react-ui-os/core";
import type { WindowPayload } from "@react-ui-os/core";
import { defaultTheme } from "@react-ui-os/theme-default";
import { createMintablesTheme } from "@react-ui-os/theme-mintables";
import { createSaasTheme } from "@react-ui-os/theme-saas";
import { docsApps } from "./apps";
import {
  NOTIFICATION_CENTER_TOGGLE_EVENT,
  SPOTLIGHT_OPEN_EVENT,
  pickInitialBounds,
  useApps,
  useTheme,
} from "@react-ui-os/desktop";
import { DocsSpotlightSource } from "./DocsSpotlightSource";

type ThemeChoice = "mintables" | "saas" | "default";

function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "mintables";
  const value = new URLSearchParams(window.location.search).get("theme");
  if (value === "saas") return "saas";
  if (value === "default") return "default";
  return "mintables";
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
 * Client-only React island that boots the desktop. Renders the standard
 * Mintables-themed Desktop, then mounts a small invisible activator that
 * reads `?demo=` and opens the matching surface on boot. The activator
 * sits inside the same provider so it can dispatch openWindow.
 */
export default function PlaygroundDesktop() {
  const themeChoice = readThemeChoice();
  const theme = useMemo<OsTheme>(() => {
    if (themeChoice === "saas") return createSaasTheme();
    if (themeChoice === "default") return defaultTheme;
    // Prefix the configured base path (e.g. "/react-ui-os/" on GitHub Pages).
    // A bare relative path would resolve against the current page URL and 404
    // on a sub-path deploy.
    const base = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    return createMintablesTheme({ wallpaperSrc: `${base}wallpaper.jpg` });
  }, [themeChoice]);

  return (
    <Desktop apps={docsApps} theme={theme} brand="react-ui-os.dev">
      <DemoActivator />
      <DocsSpotlightSource />
    </Desktop>
  );
}
