import { useEffect, useState } from "react";
import type { OsTheme } from "@react-ui-os/core";
import { setPath } from "@react-ui-os/core";
import { Desktop } from "@react-ui-os/desktop";
import {
  buildDemoTheme,
  demoWallpapers,
  type DemoThemeChoice,
} from "@react-ui-os/demo";
import { createMacosTheme } from "@react-ui-os/theme-macos";
import { docsApps } from "../playground/apps";
import {
  ColorField,
  Section,
  SelectField,
  SliderField,
  TextField,
  ToggleField,
  panelHairline,
  panelMuted,
  panelText,
} from "./controls";
import { serializeTheme } from "./serialize-theme";

const ASSET_BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

type PresetChoice = DemoThemeChoice | "skeleton";

const PRESETS: Array<{ id: PresetChoice; label: string }> = [
  { id: "macos", label: "macOS" },
  { id: "windows", label: "Windows" },
  { id: "ubuntu", label: "Ubuntu" },
  { id: "skeleton", label: "Skeleton" },
];

// The editor edits one appearance: the preset's light/dark variants and their
// Settings switch are dropped so every control changes what is on screen.
// (Add an `appearances` block by hand for a dual-look theme; see the docs.)
function loadPreset(choice: PresetChoice): OsTheme {
  // The unbranded baseline for building a new look from scratch, rather than
  // un-theming a platform clone: the macOS skeleton with no wallpaper and a
  // fresh identity.
  const theme =
    choice === "skeleton"
      ? { ...createMacosTheme(), id: "my-theme", name: "My theme" }
      : buildDemoTheme(choice, ASSET_BASE);
  const customizable = { ...theme.customizable };
  delete customizable["appearance"];
  delete customizable["wallpaper.src"];
  return { ...theme, appearance: undefined, appearances: undefined, customizable };
}

// A work-in-progress theme survives a reload. OsTheme is plain data, so a
// JSON round-trip is lossless; anything unparseable falls back to the macOS
// preset.
const STORAGE_KEY = "rui-os:theme-editor";

function parseTheme(raw: string | null): OsTheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OsTheme;
    if (typeof parsed.id !== "string" || typeof parsed.palette?.accent !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readStoredTheme(): OsTheme | null {
  if (typeof window === "undefined") return null;
  return parseTheme(window.localStorage.getItem(STORAGE_KEY));
}

// A share link carries the whole theme in the URL hash (#theme=<base64 JSON>),
// so a clicked-together look can be sent to a teammate. An incoming link wins
// over the local draft; the hash is then cleared so later edits go to the
// draft as usual. base64 keeps the JSON's quotes and spaces URL-safe.
function readSharedTheme(): OsTheme | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#theme=(.+)$/);
  if (!match?.[1]) return null;
  try {
    return parseTheme(
      new TextDecoder().decode(
        Uint8Array.from(window.atob(match[1]), (c) => c.charCodeAt(0)),
      ),
    );
  } catch {
    return null;
  }
}

function shareUrl(theme: OsTheme): string {
  const json = JSON.stringify(theme);
  const base64 = window.btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  const url = new URL(window.location.href);
  url.hash = `theme=${base64}`;
  return url.toString();
}

// Captured once at module load (the page is client:only, so this runs in the
// browser before React mounts). The hash is then cleared so the link's
// recipient edits a normal draft from there on and a reload keeps their copy
// rather than resetting to the link. Deferred a tick: a replaceState issued
// while the navigation is still committing is undone when the browser
// finalizes the history entry.
const incomingSharedTheme = readSharedTheme();
if (incomingSharedTheme && typeof window !== "undefined") {
  window.setTimeout(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, 0);
}

// The preview wallpaper and launcher glyph are docs-site assets. They make no
// sense in a consumer's project, so the exported file drops them (the header
// comment says how to supply your own).
function exportableTheme(theme: OsTheme): OsTheme {
  let out = theme;
  if (out.wallpaper.src?.startsWith(ASSET_BASE)) {
    out = { ...out, wallpaper: { ...out.wallpaper, src: undefined } };
  }
  if (out.chrome.launcherIconSrc?.startsWith(ASSET_BASE)) {
    out = { ...out, chrome: { ...out.chrome, launcherIconSrc: undefined } };
  }
  return out;
}

const EASINGS = [
  { value: "cubic-bezier(0.2, 0.85, 0.25, 1)", label: "macOS pop" },
  { value: "cubic-bezier(0.1, 0.9, 0.2, 1)", label: "Fluent decelerate" },
  { value: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", label: "Ease-out quad (GNOME)" },
  { value: "cubic-bezier(0.16, 1, 0.3, 1)", label: "Ease-out expo" },
  { value: "cubic-bezier(0.32, 0.72, 0, 1)", label: "Mission Control glide" },
  { value: "ease-out", label: "ease-out" },
  { value: "linear", label: "linear" },
];

const blurPx = (filter: string) =>
  Number(filter.match(/blur\((\d+(?:\.\d+)?)px\)/)?.[1] ?? 0);
const saturatePct = (filter: string) =>
  Number(filter.match(/saturate\((\d+(?:\.\d+)?)%\)/)?.[1] ?? 100);
const composeFilter = (blur: number, saturate: number) =>
  `blur(${blur}px) saturate(${saturate}%)`;

const panelButton = {
  border: `1px solid ${panelHairline}`,
  background: "rgba(255, 255, 255, 0.07)",
  color: panelText,
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
  padding: "6px 10px",
  cursor: "pointer",
} as const;

/**
 * The theme editor: a full-viewport live desktop with a floating control
 * panel. Every control writes into one OsTheme object (the same dotted-path
 * mechanism the Settings overlay uses), the desktop re-renders with it, and
 * the export button prints the object as a ready-to-paste theme file.
 */
export default function ThemeEditor() {
  const [theme, setTheme] = useState<OsTheme>(
    () => incomingSharedTheme ?? readStoredTheme() ?? loadPreset("macos"),
  );
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const copyShareLink = () => {
    void navigator.clipboard.writeText(shareUrl(theme)).then(() => {
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    });
  };

  const set = (path: string, value: unknown) =>
    setTheme((t) => setPath(t, path, value));

  const copyFile = () => {
    void navigator.clipboard
      .writeText(serializeTheme(exportableTheme(theme)))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      });
  };

  const downloadFile = () => {
    const blob = new Blob([serializeTheme(exportableTheme(theme))], {
      type: "text/typescript",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.id || "my-theme"}.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Desktop apps={docsApps} theme={theme}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            ...panelButton,
            position: "fixed",
            top: 44,
            right: 12,
            zIndex: 9500,
            background: "rgba(12, 14, 22, 0.88)",
            backdropFilter: "blur(16px)",
          }}
        >
          Edit theme
        </button>
      )}
      {open && (
        <aside
          aria-label="Theme editor"
          style={{
            position: "fixed",
            top: 40,
            right: 12,
            bottom: 12,
            zIndex: 9500,
            width: "min(330px, calc(100vw - 24px))",
            display: "flex",
            flexDirection: "column",
            borderRadius: 12,
            border: `1px solid ${panelHairline}`,
            background: "rgba(12, 14, 22, 0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            color: panelText,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            boxShadow: "0 16px 40px -12px rgba(0, 0, 0, 0.45)",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px 8px",
            }}
          >
            <strong style={{ fontSize: 13 }}>Theme editor</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ ...panelButton, padding: "3px 8px" }}
              aria-label="Hide the editor panel"
            >
              Hide
            </button>
          </header>

          <div style={{ padding: "0 12px 8px" }}>
            <span style={{ fontSize: 12, color: panelMuted }}>Start from</span>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTheme(loadPreset(p.id))}
                  style={{ ...panelButton, flex: 1 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                lineHeight: 1.5,
                color: panelMuted,
              }}
            >
              The editor edits one appearance. For a separate light and dark look, add
              an <code>appearances</code> block to the exported file; see{" "}
              <a
                href="../themes/overview/#light-and-dark-appearance"
                target="_blank"
                rel="noreferrer"
                style={{ color: panelText }}
              >
                Light and dark appearance
              </a>
              .
            </p>
            <Section title="Identity" defaultOpen>
              <TextField
                label="id (storage key and file name)"
                value={theme.id}
                onChange={(v) => set("id", v)}
                placeholder="my-theme"
              />
              <TextField
                label="Name"
                value={theme.name}
                onChange={(v) => set("name", v)}
              />
              <TextField
                label="Font stack"
                value={theme.font ?? ""}
                onChange={(v) => set("font", v === "" ? undefined : v)}
                placeholder="system-ui, sans-serif"
              />
            </Section>

            <Section title="Palette" defaultOpen>
              <ColorField
                label="Accent"
                value={theme.palette.accent}
                onChange={(v) => set("palette.accent", v)}
              />
              <ColorField
                label="Background (behind the wallpaper)"
                value={theme.palette.background}
                onChange={(v) => set("palette.background", v)}
              />
              <ColorField
                label="Surface (keep alpha so the blur shows)"
                value={theme.palette.surface}
                onChange={(v) => set("palette.surface", v)}
              />
              <ColorField
                label="Text primary"
                value={theme.palette.textPrimary}
                onChange={(v) => set("palette.textPrimary", v)}
              />
              <ColorField
                label="Text secondary"
                value={theme.palette.textSecondary}
                onChange={(v) => set("palette.textSecondary", v)}
              />
              <ColorField
                label="Border hairline"
                value={theme.palette.border}
                onChange={(v) => set("palette.border", v)}
              />
            </Section>

            <Section title="Shape">
              <SliderField
                label="Window radius"
                value={theme.shape.windowRadius}
                onChange={(v) => set("shape.windowRadius", v)}
                min={0}
                max={32}
                unit="px"
              />
              <SliderField
                label="Dock tile radius"
                value={theme.shape.dockTileRadius}
                onChange={(v) => set("shape.dockTileRadius", v)}
                min={0}
                max={32}
                unit="px"
              />
              <SliderField
                label="Small (pills, tooltips)"
                value={theme.shape.small}
                onChange={(v) => set("shape.small", v)}
                min={0}
                max={16}
                unit="px"
              />
            </Section>

            <Section title="Motion">
              <SliderField
                label="Window open"
                value={theme.motion.windowOpenDurationMs}
                onChange={(v) => set("motion.windowOpenDurationMs", v)}
                min={0}
                max={400}
                step={10}
                unit="ms"
              />
              <SelectField
                label="Window open easing"
                value={theme.motion.windowOpenEasing}
                onChange={(v) => set("motion.windowOpenEasing", v)}
                options={EASINGS}
              />
              <SliderField
                label="Minimize genie"
                value={theme.motion.genieDurationMs}
                onChange={(v) => set("motion.genieDurationMs", v)}
                min={0}
                max={600}
                step={10}
                unit="ms"
              />
              <SelectField
                label="Genie easing"
                value={theme.motion.genieEasing}
                onChange={(v) => set("motion.genieEasing", v)}
                options={EASINGS}
              />
              <SliderField
                label="Dock hover"
                value={theme.motion.dockHoverDurationMs}
                onChange={(v) => set("motion.dockHoverDurationMs", v)}
                min={0}
                max={300}
                step={10}
                unit="ms"
              />
              <SliderField
                label="Dock magnification (1 = off)"
                value={theme.motion.dockMagnification ?? 1.5}
                onChange={(v) => set("motion.dockMagnification", v)}
                min={1}
                max={2}
                step={0.05}
                unit="×"
              />
              <SliderField
                label="Mission Control"
                value={theme.motion.missionControlDurationMs}
                onChange={(v) => set("motion.missionControlDurationMs", v)}
                min={0}
                max={500}
                step={10}
                unit="ms"
              />
            </Section>

            <Section title="Blur">
              <SliderField
                label="Surface blur"
                value={blurPx(theme.blur.surface)}
                onChange={(v) =>
                  set("blur.surface", composeFilter(v, saturatePct(theme.blur.surface)))
                }
                min={0}
                max={48}
                unit="px"
              />
              <SliderField
                label="Surface saturation"
                value={saturatePct(theme.blur.surface)}
                onChange={(v) =>
                  set("blur.surface", composeFilter(blurPx(theme.blur.surface), v))
                }
                min={100}
                max={220}
                step={5}
                unit="%"
              />
              <SliderField
                label="Launcher blur"
                value={blurPx(theme.blur.spotlight)}
                onChange={(v) =>
                  set(
                    "blur.spotlight",
                    composeFilter(v, saturatePct(theme.blur.spotlight)),
                  )
                }
                min={0}
                max={48}
                unit="px"
              />
            </Section>

            <Section title="Wallpaper">
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                {demoWallpapers(ASSET_BASE).map((w) => (
                  <button
                    key={w.src}
                    type="button"
                    title={w.label}
                    onClick={() => set("wallpaper.src", w.src)}
                    style={{
                      padding: 0,
                      width: 46,
                      height: 30,
                      borderRadius: 5,
                      overflow: "hidden",
                      cursor: "pointer",
                      border:
                        theme.wallpaper.src === w.src
                          ? `2px solid ${panelText}`
                          : `1px solid ${panelHairline}`,
                      background: "transparent",
                    }}
                  >
                    <img
                      src={w.src}
                      alt={w.label}
                      width={46}
                      height={30}
                      style={{ display: "block", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
              <TextField
                label="Image URL (your own file in the export)"
                value={theme.wallpaper.src ?? ""}
                onChange={(v) => set("wallpaper.src", v === "" ? undefined : v)}
                placeholder="/wallpaper.jpg"
              />
              <ToggleField
                label="Cursor parallax"
                value={theme.wallpaper.parallax ?? false}
                onChange={(v) => set("wallpaper.parallax", v)}
              />
              <ToggleField
                label="Vignette"
                value={theme.wallpaper.vignette ?? false}
                onChange={(v) => set("wallpaper.vignette", v)}
              />
            </Section>

            <Section title="Chrome">
              <SelectField
                label="Window controls"
                value={theme.chrome.windowControls}
                onChange={(v) => set("chrome.windowControls", v)}
                options={[
                  { value: "traffic-lights", label: "Traffic lights (macOS)" },
                  { value: "windows", label: "Caption buttons (Windows)" },
                  { value: "gnome", label: "Round symbolic (GNOME)" },
                  { value: "minimal", label: "Minimal (close only)" },
                ]}
              />
              <SelectField
                label="Dock position"
                value={theme.chrome.dockPosition}
                onChange={(v) => set("chrome.dockPosition", v)}
                options={[
                  { value: "bottom", label: "Bottom" },
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                  { value: "top", label: "Top" },
                  { value: "hidden", label: "Hidden" },
                ]}
              />
              <SelectField
                label="Dock style"
                value={theme.chrome.dockStyle ?? "floating"}
                onChange={(v) => set("chrome.dockStyle", v)}
                options={[
                  { value: "floating", label: "Floating pill (macOS)" },
                  { value: "bar", label: "Flush bar (taskbar / GNOME)" },
                ]}
              />
              <SelectField
                label="Launcher"
                value={theme.chrome.launcher ?? "spotlight"}
                onChange={(v) => set("chrome.launcher", v)}
                options={[
                  { value: "spotlight", label: "Spotlight palette (macOS)" },
                  { value: "grid", label: "App grid (GNOME)" },
                  { value: "menu", label: "Start menu (Windows)" },
                ]}
              />
              <SelectField
                label="Menu bar"
                value={theme.chrome.menuBar}
                onChange={(v) => set("chrome.menuBar", v)}
                options={[
                  { value: "top", label: "Top" },
                  { value: "in-window", label: "In window" },
                  { value: "none", label: "None" },
                ]}
              />
              <SelectField
                label="Clock placement"
                value={theme.chrome.menuBarClock ?? "right"}
                onChange={(v) => set("chrome.menuBarClock", v)}
                options={[
                  { value: "right", label: "Right (macOS)" },
                  { value: "center", label: "Center (GNOME)" },
                ]}
              />
              <ToggleField
                label="Brand button in the menu bar"
                value={theme.chrome.menuBarBrand ?? true}
                onChange={(v) => set("chrome.menuBarBrand", v)}
              />
              <ToggleField
                label="Quick Settings popover"
                value={theme.chrome.quickSettings ?? false}
                onChange={(v) => set("chrome.quickSettings", v)}
              />
              <SliderField
                label="Dock tile size"
                value={theme.chrome.dockTileSize ?? 56}
                onChange={(v) => set("chrome.dockTileSize", v)}
                min={32}
                max={72}
                unit="px"
              />
              <SliderField
                label="Dock icon scale"
                value={theme.chrome.dockIconScale ?? 0.5}
                onChange={(v) => set("chrome.dockIconScale", v)}
                min={0.4}
                max={1}
                step={0.02}
                unit="×"
              />
              <SliderField
                label="Menu bar height"
                value={theme.chrome.menuBarHeight ?? 24}
                onChange={(v) => set("chrome.menuBarHeight", v)}
                min={20}
                max={40}
                unit="px"
              />
            </Section>
          </div>

          <footer
            style={{
              padding: 12,
              borderTop: `1px solid ${panelHairline}`,
              display: "flex",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={copyFile}
              style={{ ...panelButton, flex: 1, fontWeight: 600 }}
            >
              {copied ? "Copied" : "Copy theme file"}
            </button>
            <button type="button" onClick={downloadFile} style={panelButton}>
              Download
            </button>
            <button
              type="button"
              onClick={copyShareLink}
              style={panelButton}
              title="Copy a link that opens the editor with this theme"
            >
              {shared ? "Copied" : "Share"}
            </button>
          </footer>
        </aside>
      )}
    </Desktop>
  );
}
