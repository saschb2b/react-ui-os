import type { App as OsApp } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import { defaultTheme } from "@react-ui-os/theme-default";

function HelloContent({ focused }: { focused: boolean }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Hello, desktop.</h2>
      <p style={{ margin: "0 0 12px", opacity: 0.75 }}>
        Drag this window by the title bar. Click the green light to maximize,
        the yellow one to minimize into the dock, the red one to close.
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
      <p style={{ margin: 0, opacity: 0.75 }}>
        Two apps proves the focus model and dock indicator dots. Open me from
        the dock, then click Hello and watch the focused-app name in the menu
        bar update.
      </p>
    </div>
  );
}

const apps: OsApp[] = [
  {
    id: "hello",
    name: "Hello",
    accent: "#6b8afd",
    content: HelloContent,
    defaultBounds: { w: 520, h: 320 },
  },
  {
    id: "notes",
    name: "Notes",
    accent: "#f59e0b",
    content: NotesContent,
    defaultBounds: { w: 480, h: 300 },
  },
];

export default function App() {
  return <Desktop apps={apps} theme={defaultTheme} brand="react-ui-os" />;
}
