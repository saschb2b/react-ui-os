import type { App } from "@react-ui-os/core";
import { registerSystemWindow } from "@react-ui-os/desktop";
import { useDesktopContext } from "@react-ui-os/desktop";
import { addRecent, hasRecents } from "./recents";
import { RecentsFolder } from "./RecentsFolder";

// State-earned Recents folder: the desktop icon appears once the user
// has added an entry from Hello, disappears when the last is deleted.
registerSystemWindow("recents", {
  name: "Recents",
  tagline: "Recently created items",
  accent: "#6b8afd",
  defaultBounds: { w: 560, h: 420 },
  content: RecentsFolder,
  appearsAsDesktopIcon: (storage) => hasRecents(storage),
});

function HelloContent({ focused }: { focused: boolean }) {
  const { storage } = useDesktopContext();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Hello, desktop.</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Drag the title bar. Drag any edge or corner to resize. Double-click
        to maximize, then press Escape to restore.
      </p>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Press <kbd>Cmd-K</kbd> for Spotlight, <kbd>Cmd-,</kbd> for Settings.
        Cmd-1/2/3 jumps between apps.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={() => {
            const labels = ["Sketch", "Recipe", "Idea", "Bookmark", "Todo"];
            const kinds = ["txt", "md", "url"];
            const label = labels[Math.floor(Math.random() * labels.length)];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            addRecent(storage, {
              name: `${label ?? "Item"} ${String(Date.now()).slice(-4)}`,
              kind: kind ?? "txt",
            });
          }}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "inherit",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 12,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          + Add to Recents
        </button>
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          A Recents folder will appear on the desktop.
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        Window focused: <strong>{focused ? "yes" : "no"}</strong>
      </p>
    </div>
  );
}

function NotesContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Notes</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Plain notes app. Open me by clicking my dock tile, by pressing{" "}
        <kbd>Cmd-2</kbd>, or by typing "notes" into Spotlight.
      </p>
    </div>
  );
}

function CalculatorContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Calculator</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Three apps gives Spotlight something to search. Try{" "}
        <kbd>Cmd-K</kbd> then "calc".
      </p>
    </div>
  );
}

export const docsApps: App[] = [
  {
    id: "hello",
    name: "Hello",
    tagline: "Try the library",
    accent: "#6b8afd",
    content: HelloContent,
    defaultBounds: { w: 560, h: 380 },
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
