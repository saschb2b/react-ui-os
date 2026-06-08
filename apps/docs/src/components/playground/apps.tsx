import type { ComponentType, CSSProperties } from "react";
import type { App } from "@react-ui-os/core";
import { notify } from "@react-ui-os/core";
import { registerStatusItem, registerSystemWindow } from "@react-ui-os/desktop";
import { useDesktopContext } from "@react-ui-os/desktop";
import { exampleApps } from "@react-ui-os/example-apps";
import { addRecent, hasRecents } from "./recents";
import { RecentsFolder } from "./RecentsFolder";

// Demo status item: a small "online" dot in the menu bar tray. Real
// products would surface battery, sync state, or a current track here.
registerStatusItem({
  id: "demo-online",
  icon: (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
      <circle cx="6" cy="6" r="4" fill="#22c55e" />
    </svg>
  ),
  tooltip: "Online",
  order: 50,
});

// A clickable demo: rings a toast so visitors connect "menu-bar widget"
// with the rest of the library.
registerStatusItem({
  id: "demo-ring",
  icon: <span style={{ fontSize: 13, lineHeight: 1 }}>♪</span>,
  tooltip: "Tap to chime",
  shortcut: "demo",
  order: 60,
  onClick: () => {
    notify({ title: "Ding", body: "A status-item click fired this.", level: "info" });
  },
});

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

const demoButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer",
};

function HelloContent({ focused }: { focused: boolean }) {
  const { storage } = useDesktopContext();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Hello, desktop.</h2>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Drag the title bar. Drag any edge or corner to resize. Double-click to maximize,
        then press Escape to restore.
      </p>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Press <kbd>Cmd-K</kbd> for Spotlight, <kbd>Cmd-,</kbd> for Settings. Cmd-1/2/3
        jumps between apps.
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
          style={demoButton}
        >
          + Add to Recents
        </button>
        <button
          type="button"
          onClick={() => {
            notify({
              title: "Hello!",
              body: "This is a toast. Click the menu-bar clock to open the Notification Center.",
              appId: "hello",
              level: "success",
            });
          }}
          style={demoButton}
        >
          + Fire a toast
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        Window focused: <strong>{focused ? "yes" : "no"}</strong>
      </p>
    </div>
  );
}

// Ubuntu's Yaru app icons (colorful), selected when the theme's iconStyle is
// "gnome". Bundled in the demo only (CC-BY-SA, see public/CREDITS.md), prefixed
// with the docs base path so they resolve on the /react-ui-os sub-path deploy.
const ICON_BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const UBUNTU_ICON_SRC: Record<string, string> = {
  hello: "hello",
  notes: "notes",
  calculator: "calculator",
  clock: "clock",
  calendar: "calendar",
  reminders: "reminders",
  sketch: "sketch",
  terminal: "terminal",
};

function pngIcon(src: string): ComponentType<{ size?: number }> {
  return function PngIcon({ size = 24 }: { size?: number }) {
    return (
      <img src={src} width={size} height={size} alt="" style={{ display: "block" }} />
    );
  };
}

// The docs demo carries its own Hello window (with the "Fire a toast" button
// above), then shares the real app suite with the playground so both surfaces
// stay in sync (including the per-theme icons). See @react-ui-os/example-apps.
const helloApp: App = {
  id: "hello",
  name: "Hello",
  tagline: "Try the library",
  accent: "#6b8afd",
  content: HelloContent,
  defaultBounds: { w: 560, h: 380 },
};

export const docsApps: App[] = [helloApp, ...exampleApps].map((app) => {
  const key = UBUNTU_ICON_SRC[app.id];
  return key
    ? { ...app, icons: { ...app.icons, gnome: pngIcon(`${ICON_BASE}yaru/${key}.png`) } }
    : app;
});
