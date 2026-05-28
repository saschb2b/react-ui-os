import type { App } from "@react-ui-os/core";
import { useWindowManager } from "@react-ui-os/core";
import { registerSystemWindow } from "@react-ui-os/desktop";
import {
  ComponentReference,
  componentNames,
  componentReferenceTitle,
} from "./component-reference";

// Register a single Component reference system window. Args carry the
// component name; the new WindowPayload args extension lets two of these
// coexist (one per name) because windowIdOf encodes the args.
registerSystemWindow("component", {
  name: (args) =>
    componentReferenceTitle(args as { name?: unknown } | undefined),
  tagline: "API reference",
  accent: "#7c66f5",
  defaultBounds: { w: 520, h: 380 },
  content: ComponentReference,
});

function GetStartedContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>react-ui-os</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        A React component library that ships a working OS-style desktop in one
        line. You are looking at the docs site, which is itself an instance of
        the library.
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
      >{`import { Desktop } from "@react-ui-os/desktop";
import { defaultTheme } from "@react-ui-os/theme-default";

<Desktop apps={apps} theme={defaultTheme} />;`}</pre>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Try <kbd>Cmd-K</kbd> for Spotlight, <kbd>Cmd-,</kbd> for Settings, drag
        a window edge to resize, drag the title bar to move.
      </p>
    </div>
  );
}

function ComponentsContent() {
  const { openWindow } = useWindowManager();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Components</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Click any component to open its API in its own window. Two windows
        for two components can sit side by side: the library uses the new
        SystemWindowArgs to address each instance distinctly.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 6,
        }}
      >
        {componentNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              openWindow(
                { kind: "system", systemId: "component", args: { name } },
                { x: 120 + componentNames.indexOf(name) * 32, y: 100, w: 520, h: 380 },
              );
            }}
            style={{
              padding: "8px 10px",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              color: "inherit",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              fontSize: 12,
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemesContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Themes</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        The skeleton is one thing. The look is a theme. Mintables ships as one
        theme; you can write your own with createOsTheme(...).
      </p>
      <p style={{ margin: 0, opacity: 0.78 }}>
        End-user tweaks live in Settings (Cmd-,). The active theme declares
        which tokens are user-customizable; the library renders the panel.
      </p>
    </div>
  );
}

export const docsApps: App[] = [
  {
    id: "get-started",
    name: "Get Started",
    tagline: "Install + one-line API",
    accent: "#5cb6b9",
    content: GetStartedContent,
    defaultBounds: { w: 560, h: 420 },
  },
  {
    id: "components",
    name: "Components",
    tagline: "Browse the inventory",
    accent: "#7c66f5",
    content: ComponentsContent,
    defaultBounds: { w: 520, h: 420 },
  },
  {
    id: "themes",
    name: "Themes",
    tagline: "Skin the skeleton",
    accent: "#f59e0b",
    content: ThemesContent,
    defaultBounds: { w: 520, h: 380 },
  },
];
