import type { App as OsApp } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import { defaultTheme } from "@react-ui-os/theme-default";

function HelloContent({ focused }: { focused: boolean }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Hello, desktop.</h2>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Drag the title bar. Drag any edge or corner to resize. Double-click the
        title bar (or click the green light) to maximize, then press Escape to
        restore.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Press <kbd>Cmd-K</kbd> or <kbd>Ctrl-K</kbd> for Spotlight.{" "}
        <kbd>Cmd-W</kbd> closes this window, <kbd>Cmd-M</kbd> minimizes it,{" "}
        <kbd>Cmd-1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> jump between apps.
      </p>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        Window focused: <strong>{focused ? "yes" : "no"}</strong>
      </p>
    </div>
  );
}

function NotesContent() {
  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Notes</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Plain notes app. Open me by clicking my dock tile, by pressing{" "}
        <kbd>Cmd-2</kbd>, or by typing "notes" into Spotlight.
      </p>
    </div>
  );
}

function CalculatorContent() {
  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Calculator</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Three apps gives Spotlight something to search. Try{" "}
        <kbd>Cmd-K</kbd> then "calc".
      </p>
    </div>
  );
}

const apps: OsApp[] = [
  {
    id: "hello",
    name: "Hello",
    tagline: "Phase 1 demo",
    accent: "#6b8afd",
    content: HelloContent,
    defaultBounds: { w: 560, h: 360 },
  },
  {
    id: "notes",
    name: "Notes",
    tagline: "Plain-text scratchpad",
    accent: "#f59e0b",
    content: NotesContent,
    defaultBounds: { w: 480, h: 300 },
  },
  {
    id: "calculator",
    name: "Calculator",
    tagline: "Arithmetic and conversions",
    accent: "#22c55e",
    content: CalculatorContent,
    defaultBounds: { w: 320, h: 360 },
  },
];

export default function App() {
  return <Desktop apps={apps} theme={defaultTheme} brand="react-ui-os" />;
}
