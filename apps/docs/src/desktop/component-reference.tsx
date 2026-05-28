import type { ReactNode } from "react";
import type { SystemWindowContentProps } from "@react-ui-os/desktop";

interface ComponentEntry {
  name: string;
  tagline: string;
  body: ReactNode;
}

const components: Record<string, ComponentEntry> = {
  Desktop: {
    name: "Desktop",
    tagline: "One-line entry point",
    body: (
      <>
        <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
          Wraps the provider stack and composes the default surfaces:
          wallpaper, menu bar, dock, window layer, keyboard shortcuts, and
          Spotlight. Pass an apps array and a theme.
        </p>
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "rgba(0,0,0,0.35)",
            borderRadius: 6,
            fontSize: 12,
            overflow: "auto",
          }}
        >{`<Desktop apps={apps} theme={defaultTheme} brand="acme" />`}</pre>
      </>
    ),
  },
  Spotlight: {
    name: "Spotlight",
    tagline: "Cmd-K command palette",
    body: (
      <>
        <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
          Centered frosted-glass palette toggled by Cmd-K. Self-contained:
          listens for both the keyboard shortcut and the SPOTLIGHT_OPEN_EVENT
          custom event, so any UI element can open it without prop drilling.
        </p>
        <p style={{ margin: 0, opacity: 0.78 }}>
          Fuzzy-searches across the apps registry and the system windows
          registry. Activating any result calls openWindow.
        </p>
      </>
    ),
  },
  Window: {
    name: "Window",
    tagline: "Chrome + drag + focus + animations",
    body: (
      <>
        <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
          The actual window the WindowLayer compositor renders. Traffic
          lights, drag from the title bar, 8-grip resize, double-click
          maximize, genie minimize toward the matching dock tile.
        </p>
        <p style={{ margin: 0, opacity: 0.78 }}>
          Drag writes the transform directly to the DOM during the gesture
          and only commits to React on pointer-up. Keeps multi-window scenes
          at 60 fps.
        </p>
      </>
    ),
  },
  Settings: {
    name: "Settings",
    tagline: "Customizable theme schema renderer",
    body: (
      <>
        <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
          Real desktop window (not a dialog) that reads theme.customizable
          and renders one editor per field. Opens via Cmd-,.
        </p>
        <p style={{ margin: 0, opacity: 0.78 }}>
          Persists user prefs via the storage adapter; overrides apply
          immediately via the effective-theme overlay.
        </p>
      </>
    ),
  },
  FileExplorer: {
    name: "FileExplorer",
    tagline: "Finder-style item browser",
    body: (
      <>
        <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
          Item-agnostic. Pass an items array of your own shape mapped to
          ExplorerItem, optional actions, an onOpen, and (for editable
          lists) an onRename. The explorer owns selection, view mode, sort,
          search, rename, and the right-click context menu.
        </p>
        <p style={{ margin: 0, opacity: 0.78 }}>
          Selection model mirrors macOS Finder: click sets, Cmd-click
          toggles, Shift-click range-selects, F2 begins rename.
        </p>
      </>
    ),
  },
};

export const componentNames = Object.keys(components);

/**
 * Single SystemWindowDef.content that renders the right component reference
 * based on `args.name`. Two windows opened with different `args.name`
 * coexist because the new WindowPayload args participate in windowIdOf —
 * the library extension that unlocked this docs page.
 */
export function ComponentReference({ args }: SystemWindowContentProps) {
  const name = typeof args?.name === "string" ? args.name : undefined;
  const entry = name ? components[name] : undefined;

  if (!entry) {
    return (
      <div style={{ opacity: 0.6, fontSize: 13 }}>
        Pick a component from the Components app.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{entry.name}</h2>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            opacity: 0.65,
            fontStyle: "italic",
          }}
        >
          {entry.tagline}
        </p>
      </header>
      {entry.body}
    </div>
  );
}

/** Title for the system window varies with the args. */
export function componentReferenceTitle(args?: { name?: unknown }): string {
  const name = typeof args?.name === "string" ? args.name : undefined;
  return name ? `Component · ${name}` : "Component";
}
