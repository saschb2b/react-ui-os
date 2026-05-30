import { useMemo } from "react";
import type { App as OsApp, OsTheme } from "@react-ui-os/core";
import { Desktop, registerSystemWindow, useDesktopContext } from "@react-ui-os/desktop";
import { defaultTheme } from "@react-ui-os/theme-default";
import { createMintablesTheme } from "@react-ui-os/theme-mintables";
import { createSaasTheme } from "@react-ui-os/theme-saas";
import { addRecent, hasRecents } from "./recents";
import { RecentsFolder } from "./RecentsFolder";
import { calculatorApp } from "./apps/calculator";
import { notesApp } from "./apps/notes";
import { clockApp } from "./apps/clock";
import { calendarApp } from "./apps/calendar";
import { remindersApp } from "./apps/reminders";
import { sketchApp } from "./apps/sketch";
import { terminalApp } from "./apps/terminal";

// Register the Recents system window once at module load. The desktop
// icon for it surfaces only when `hasRecents(storage)` returns true, so
// the folder appears the moment the user adds their first entry and
// disappears when they delete the last one.
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
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Hello, desktop.</h2>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Drag the title bar. Drag any edge or corner to resize. Double-click the title
        bar (or click the green light) to maximize, then press Escape to restore.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Press <kbd>Cmd-K</kbd> or <kbd>Ctrl-K</kbd> for Spotlight, <kbd>Cmd-,</kbd> for
        Settings. <kbd>Cmd-W</kbd> closes, <kbd>Cmd-M</kbd> minimizes, <kbd>Cmd-1</kbd>/
        <kbd>2</kbd>/<kbd>3</kbd> jumps between apps.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Try a different theme: append <kbd>?theme=mintables</kbd> or{" "}
        <kbd>?theme=saas</kbd> to the URL and reload. SaaS pins the dock to the left
        edge and hides the menu bar.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "12px 0",
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
          Once you add one, a Recents folder appears on the right edge.
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        Window focused: <strong>{focused ? "yes" : "no"}</strong>
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
    defaultBounds: { w: 580, h: 460 },
  },
  notesApp,
  calculatorApp,
  clockApp,
  calendarApp,
  remindersApp,
  sketchApp,
  terminalApp,
];

type ThemeChoice = "default" | "mintables" | "saas";

function readThemeFromUrl(): ThemeChoice {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("theme");
  if (requested === "mintables") return "mintables";
  if (requested === "saas") return "saas";
  return "default";
}

export default function App() {
  const themeChoice = readThemeFromUrl();
  const theme = useMemo<OsTheme>(() => {
    if (themeChoice === "mintables") {
      return createMintablesTheme({ wallpaperSrc: "/wallpaper.jpg" });
    }
    if (themeChoice === "saas") {
      return createSaasTheme();
    }
    return defaultTheme;
  }, [themeChoice]);

  return <Desktop apps={apps} theme={theme} brand="react-ui-os" />;
}
