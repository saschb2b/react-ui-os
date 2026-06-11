import { useEffect, useMemo, useState } from "react";
import type { OsTheme } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import { notify, useWindowManager } from "@react-ui-os/core";
import type { WindowPayload } from "@react-ui-os/core";
import {
  buildDemoTheme,
  isThemeChoice,
  persistThemeChoice,
  readInitialThemeChoice,
  type DemoThemeChoice,
} from "@react-ui-os/demo";
import { docsApps } from "./apps";
import {
  NOTIFICATION_CENTER_TOGGLE_EVENT,
  SPOTLIGHT_OPEN_EVENT,
  pickInitialBounds,
  useApps,
  useTheme,
} from "@react-ui-os/desktop";
import { DocsSpotlightSource } from "./DocsSpotlightSource";
import { StartRecents } from "./StartRecents";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UbuntuQuickSettings } from "./UbuntuQuickSettings";

// The docs serves its public/ under the /react-ui-os/ deploy base. The apps,
// per-theme icons, and theme builder all come from the shared @react-ui-os/demo
// config so this embed and the playground cannot drift.
const ASSET_BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

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
  const [themeChoice, setThemeChoice] =
    useState<DemoThemeChoice>(readInitialThemeChoice);
  const theme = useMemo<OsTheme>(
    () => buildDemoTheme(themeChoice, ASSET_BASE),
    [themeChoice],
  );

  // When embedded in the landing hero (?embed=1), the page owns the single OS
  // switcher, so hide the in-canvas one to avoid a duplicate control.
  const embedded =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embed") === "1";

  const handleThemeChange = (choice: DemoThemeChoice) => {
    setThemeChoice(choice);
    persistThemeChoice(choice);
  };

  // Let the embedding page (the landing's OS switcher) morph the live desktop
  // via postMessage, so a visitor can flip macOS/Windows/Ubuntu from the page
  // chrome and watch the whole thing transform. Also report the current look
  // back so the landing's pills stay in sync with in-canvas switches.
  useEffect(() => {
    // Typed structurally (not as MessageEvent) to avoid a no-undef on the DOM
    // global; addEventListener still narrows the runtime event for us.
    const onMessage = (e: { data?: unknown }) => {
      const data = e.data as { type?: string; theme?: string } | null;
      if (
        data?.type === "rui:set-theme" &&
        typeof data.theme === "string" &&
        isThemeChoice(data.theme)
      ) {
        handleThemeChange(data.theme);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    window.parent.postMessage({ type: "rui:theme", theme: themeChoice }, "*");
  }, [themeChoice]);

  return (
    <Desktop apps={docsApps} theme={theme}>
      <DemoActivator />
      <DocsSpotlightSource />
      <StartRecents />
      {themeChoice === "ubuntu" && <UbuntuQuickSettings />}
      {!embedded && <ThemeSwitcher value={themeChoice} onChange={handleThemeChange} />}
    </Desktop>
  );
}
