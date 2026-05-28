import type { App } from "@react-ui-os/core";

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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Components</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        The library is the chrome around your apps. Pick a component for the
        full API. (Per-component windows land once multi-instance system
        payloads are wired up.)
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          opacity: 0.78,
          lineHeight: 1.6,
          fontSize: 13,
        }}
      >
        <li>Desktop</li>
        <li>Dock</li>
        <li>MenuBar</li>
        <li>Window</li>
        <li>Spotlight</li>
        <li>Settings</li>
        <li>FileExplorer</li>
        <li>DesktopIcons</li>
      </ul>
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
