import { useEffect } from "react";
import { registerSpotlightSource } from "@react-ui-os/desktop";

interface DocsPage {
  id: string;
  name: string;
  path: string;
  kind: "intro" | "component" | "api" | "theme" | "recipe" | "showcase" | "release";
}

const DOCS_PAGES: DocsPage[] = [
  { id: "introduction", name: "Introduction", path: "/introduction/", kind: "intro" },
  { id: "installation", name: "Installation", path: "/installation/", kind: "intro" },
  { id: "quickstart", name: "Quickstart", path: "/quickstart/", kind: "intro" },
  { id: "desktop", name: "Desktop", path: "/components/desktop/", kind: "component" },
  { id: "window", name: "Window", path: "/components/window/", kind: "component" },
  { id: "dock", name: "Dock", path: "/components/dock/", kind: "component" },
  { id: "menubar", name: "MenuBar", path: "/components/menubar/", kind: "component" },
  { id: "spotlight", name: "Spotlight", path: "/components/spotlight/", kind: "component" },
  { id: "settings", name: "Settings", path: "/components/settings/", kind: "component" },
  { id: "notifications", name: "Notifications", path: "/components/notifications/", kind: "component" },
  { id: "contextmenu", name: "ContextMenu", path: "/components/contextmenu/", kind: "component" },
  { id: "snapping", name: "Window snapping", path: "/components/snapping/", kind: "component" },
  { id: "appswitcher", name: "App switcher", path: "/components/appswitcher/", kind: "component" },
  { id: "missioncontrol", name: "Mission Control", path: "/components/missioncontrol/", kind: "component" },
  { id: "hud", name: "HUD", path: "/components/hud/", kind: "component" },
  { id: "fileexplorer", name: "FileExplorer", path: "/components/fileexplorer/", kind: "component" },
  { id: "desktopicons", name: "DesktopIcons", path: "/components/desktopicons/", kind: "component" },
  { id: "usewindowmanager", name: "useWindowManager", path: "/api/usewindowmanager/", kind: "api" },
  { id: "usetheme", name: "useTheme", path: "/api/usetheme/", kind: "api" },
  { id: "usesettings", name: "useSettings", path: "/api/usesettings/", kind: "api" },
  { id: "storageadapter", name: "StorageAdapter", path: "/api/storageadapter/", kind: "api" },
  { id: "registerspotlightsource", name: "registerSpotlightSource", path: "/api/registerspotlightsource/", kind: "api" },
  { id: "themes-overview", name: "Themes overview", path: "/themes/overview/", kind: "theme" },
  { id: "themes-customizable", name: "Customizable schema", path: "/themes/customizable/", kind: "theme" },
  { id: "themes-writing", name: "Writing a theme", path: "/themes/writing/", kind: "theme" },
  { id: "recipes", name: "Recipes", path: "/recipes/overview/", kind: "recipe" },
  { id: "showcase", name: "Showcase", path: "/showcase/", kind: "showcase" },
  { id: "changelog", name: "Changelog", path: "/changelog/", kind: "release" },
];

const KIND_LABELS: Record<DocsPage["kind"], string> = {
  intro: "Docs · Start here",
  component: "Docs · Component",
  api: "Docs · API",
  theme: "Docs · Themes",
  recipe: "Docs · Recipes",
  showcase: "Docs · Showcase",
  release: "Docs · Releases",
};

const KIND_ACCENTS: Record<DocsPage["kind"], string> = {
  intro: "#5cb6b9",
  component: "#7c66f5",
  api: "#a855f7",
  theme: "#f59e0b",
  recipe: "#0ea5e9",
  showcase: "#22c55e",
  release: "#ec4899",
};

/**
 * Registers a Spotlight source so the playground's Cmd-K finds docs
 * pages, not just registered apps. Activating a row opens the docs page
 * in the parent window (escaping the iframe) so the visitor lands on
 * actual content. Demonstrates the registerSpotlightSource primitive.
 */
export function DocsSpotlightSource() {
  useEffect(() => {
    const baseUrl =
      typeof window !== "undefined" && window.parent && window.parent !== window
        ? window.parent.location?.origin
        : window.location.origin;
    const prefix = baseUrl ? `${baseUrl}/react-ui-os` : "/react-ui-os";

    return registerSpotlightSource("docs-pages", (query) => {
      if (!query) {
        // Empty query: don't flood the palette. Surface only when typing.
        return [];
      }
      const q = query.toLowerCase();
      return DOCS_PAGES.filter((page) =>
        page.name.toLowerCase().includes(q),
      ).map((page) => ({
        id: page.id,
        name: page.name,
        kindLabel: KIND_LABELS[page.kind],
        accent: KIND_ACCENTS[page.kind],
        tagline: page.path,
        onActivate: () => {
          const target = `${prefix}${page.path}`;
          // Escape the iframe if we're inside one, else navigate top-level.
          try {
            if (window.top && window.top !== window) {
              window.top.location.href = target;
              return;
            }
          } catch {
            // Cross-origin top frame — fall through to new tab.
          }
          window.open(target, "_blank", "noopener");
        },
      }));
    });
  }, []);

  return null;
}
