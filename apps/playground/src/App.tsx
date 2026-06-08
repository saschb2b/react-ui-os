import { useMemo, useState, type ComponentType } from "react";
import type { App as OsApp, OsTheme } from "@react-ui-os/core";
import {
  Desktop,
  getSystemWindow,
  registerSystemWindow,
  useDesktopContext,
  useTheme,
} from "@react-ui-os/desktop";
import { createMacosTheme } from "@react-ui-os/theme-macos";
import { createUbuntuTheme } from "@react-ui-os/theme-ubuntu";
import { createWindowsTheme } from "@react-ui-os/theme-windows";
import { exampleApps, HelloFluentIcon } from "@react-ui-os/example-apps";
import { addRecent, hasRecents } from "./recents";
import { RecentsFolder } from "./RecentsFolder";
import { RecentsIcon } from "./RecentsIcon";
import { ThemeSwitcher, type ThemeChoice } from "./ThemeSwitcher";
import { UbuntuQuickSettings } from "./UbuntuQuickSettings";

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
  icon: RecentsIcon,
  appearsAsDesktopIcon: (storage) => hasRecents(storage),
});

function HelloContent({ focused }: { focused: boolean }) {
  const { storage } = useDesktopContext();
  const theme = useTheme();
  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Hello, desktop.</h2>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Seven working apps share the dock with this one: Notes, Calculator, Clock,
        Calendar, Reminders, Sketch, and Terminal. Each is a real app, not a screenshot.
        Open one from the dock, from Spotlight, or with its number key.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Drag the title bar. Drag any edge or corner to resize. Double-click the title
        bar (or click the green light) to maximize, then press Escape to restore.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Press <kbd>Cmd-K</kbd> or <kbd>Ctrl-K</kbd> for Spotlight, <kbd>Cmd-,</kbd> for
        Settings. <kbd>Cmd-W</kbd> closes, <kbd>Cmd-M</kbd> minimizes, and{" "}
        <kbd>Cmd-1</kbd> through <kbd>Cmd-9</kbd> jump straight to an app.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Notes, reminders, and calendar events persist across reloads. In Terminal, type{" "}
        <kbd>open calendar</kbd> to launch an app straight from the shell.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Use the theme switcher at the top to swap the whole look between macOS, Windows,
        and Ubuntu. Each clones its platform's chrome: Windows trades the traffic lights
        for caption buttons and a flush taskbar that does not magnify; Ubuntu pairs a
        top bar with a left dock, centers the clock, and opens Quick Settings from the
        status cluster.
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
            border: `1px solid ${theme.palette.border}`,
            background: "transparent",
            color: "inherit",
            borderRadius: theme.shape.small,
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

const helloApp: OsApp = {
  id: "hello",
  name: "Hello",
  tagline: "Start here",
  accent: "#6b8afd",
  icons: { fluent: HelloFluentIcon },
  content: HelloContent,
  defaultBounds: { w: 580, h: 460 },
};

// Ubuntu's own Yaru app icons (colorful), selected when the theme's iconStyle is
// "gnome". Bundled in this demo only (CC-BY-SA, not in the published packages);
// see public/CREDITS.md.
const UBUNTU_ICON_SRC: Record<string, string> = {
  hello: "/yaru/hello.png",
  notes: "/yaru/notes.png",
  calculator: "/yaru/calculator.png",
  clock: "/yaru/clock.png",
  calendar: "/yaru/calendar.png",
  reminders: "/yaru/reminders.png",
  sketch: "/yaru/sketch.png",
  terminal: "/yaru/terminal.png",
};

function yaruIcon(src: string): ComponentType<{ size?: number }> {
  return function YaruIcon({ size = 24 }: { size?: number }) {
    return (
      <img src={src} width={size} height={size} alt="" style={{ display: "block" }} />
    );
  };
}

const apps: OsApp[] = [helloApp, ...exampleApps].map((app) => {
  const src = UBUNTU_ICON_SRC[app.id];
  return src ? { ...app, icons: { ...app.icons, gnome: yaruIcon(src) } } : app;
});

// Give the built-in Settings window its Ubuntu (Yaru) icon for the gnome style;
// it keeps the Lucide default (macOS) and the Fluent variant (Windows).
const settingsDef = getSystemWindow("settings");
if (settingsDef) {
  registerSystemWindow("settings", {
    ...settingsDef,
    icons: { ...settingsDef.icons, gnome: yaruIcon("/yaru/settings.png") },
  });
}

const THEME_STORAGE_KEY = "rui-os:playground-theme";

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "macos" || value === "windows" || value === "ubuntu";
}

// `?theme=` wins (an explicit, shareable deep link), then the last choice the
// visitor made, then macOS.
function readInitialThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "macos";
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (isThemeChoice(fromUrl)) return fromUrl;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeChoice(stored)) return stored;
  return "macos";
}

function persistThemeChoice(choice: ThemeChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  // Mirror the choice into the URL so the current view stays shareable
  // without forcing a reload.
  const params = new URLSearchParams(window.location.search);
  params.set("theme", choice);
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

// The bundled wallpapers, offered as a gallery in Settings > Appearance so a
// visitor can pick one (overriding the appearance default until reset).
const WALLPAPERS = [
  { src: "/macos-wallpaper.jpg", label: "Tahoe Day" },
  { src: "/macos-wallpaper-dark.jpg", label: "Tahoe Dark" },
  { src: "/windows-wallpaper.jpg", label: "Bloom Light" },
  { src: "/windows-wallpaper-dark.jpg", label: "Bloom Dark" },
  // Ubuntu 25.10 "Resolute Raccoon" wallpapers, Canonical's official set
  // (CC-BY-SA). See apps/playground/public/CREDITS.md.
  { src: "/ubuntu-wallpaper.png", label: "Resolute Raccoon" },
  { src: "/ubuntu-wallpaper-dark.png", label: "Resolute Raccoon Dark" },
  { src: "/ubuntu-wallpaper-light.png", label: "Resolute Raccoon Light" },
  { src: "/ubuntu-wallpaper-blank.png", label: "Resolute Raccoon Plain" },
];

function buildTheme(choice: ThemeChoice): OsTheme {
  if (choice === "windows") {
    return createWindowsTheme({
      wallpaperSrc: "/windows-wallpaper.jpg",
      darkWallpaperSrc: "/windows-wallpaper-dark.jpg",
      wallpaperOptions: WALLPAPERS,
    });
  }
  if (choice === "ubuntu") {
    return createUbuntuTheme({
      // Ubuntu's base look is dark; light mode gets the colorful variant.
      wallpaperSrc: "/ubuntu-wallpaper-dark.png",
      lightWallpaperSrc: "/ubuntu-wallpaper.png",
      wallpaperOptions: WALLPAPERS,
      // The real Yaru Show Applications glyph (recolored to the foreground).
      launcherIconSrc: "/yaru/show-apps.svg",
    });
  }
  return createMacosTheme({
    wallpaperSrc: "/macos-wallpaper.jpg",
    darkWallpaperSrc: "/macos-wallpaper-dark.jpg",
    wallpaperOptions: WALLPAPERS,
  });
}

export default function App() {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readInitialThemeChoice);
  const theme = useMemo<OsTheme>(() => buildTheme(themeChoice), [themeChoice]);

  const handleThemeChange = (choice: ThemeChoice) => {
    setThemeChoice(choice);
    persistThemeChoice(choice);
  };

  return (
    <Desktop apps={apps} theme={theme}>
      {themeChoice === "ubuntu" && <UbuntuQuickSettings />}
      <ThemeSwitcher value={themeChoice} onChange={handleThemeChange} />
    </Desktop>
  );
}
