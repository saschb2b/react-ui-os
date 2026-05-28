import { useEffect } from "react";
import { Desktop } from "@react-ui-os/desktop";
import { useWindowManager } from "@react-ui-os/core";
import { createMintablesTheme } from "@react-ui-os/theme-mintables";
import { docsApps } from "./apps";
import { SPOTLIGHT_OPEN_EVENT } from "@react-ui-os/desktop";

const theme = createMintablesTheme({ wallpaperSrc: "wallpaper.jpg" });

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
 */
function DemoActivator() {
  const { openWindow } = useWindowManager();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo");
    if (!demo) return;

    const t = window.setTimeout(() => {
      switch (demo) {
        case "spotlight":
          window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT));
          break;
        case "settings":
          openWindow({ kind: "system", systemId: "settings" });
          break;
        case "window":
        case "menubar":
          openWindow({ kind: "app", appId: "hello" });
          break;
        case "dock":
          openWindow({ kind: "app", appId: "hello" });
          openWindow({ kind: "app", appId: "notes" });
          openWindow({ kind: "app", appId: "calculator" });
          break;
        case "recents": {
          const now = Date.now();
          const items = [
            { id: "demo-1", name: "Sketch.txt", kind: "txt", createdAt: now - 5 * 60000 },
            { id: "demo-2", name: "Recipe.md", kind: "md", createdAt: now - 30 * 60000 },
            { id: "demo-3", name: "Bookmark", kind: "url", createdAt: now - 60 * 60000 },
            { id: "demo-4", name: "Idea.md", kind: "md", createdAt: now - 90 * 60000 },
          ];
          window.localStorage.setItem("rui-os:recents", JSON.stringify(items));
          window.dispatchEvent(
            new CustomEvent("react-ui-os:storage-changed", {
              detail: { key: "recents" },
            }),
          );
          window.setTimeout(() => {
            openWindow({ kind: "system", systemId: "recents" });
          }, 80);
          break;
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(t);
    };
  }, [openWindow]);

  return null;
}

/**
 * Client-only React island that boots the desktop. Renders the standard
 * Mintables-themed Desktop, then mounts a small invisible activator that
 * reads `?demo=` and opens the matching surface on boot. The activator
 * sits inside the same provider so it can dispatch openWindow.
 */
export default function PlaygroundDesktop() {
  return (
    <Desktop apps={docsApps} theme={theme} brand="react-ui-os.dev">
      <DemoActivator />
    </Desktop>
  );
}
