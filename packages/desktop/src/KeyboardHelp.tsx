"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "./desktop-context";
import { KEYBOARD_HELP_TOGGLE_EVENT } from "./events";
import { formatChord, SHORTCUTS, type Shortcut } from "./keymap";

const DEFAULT_SHADOW = "0 24px 60px -16px rgba(0,0,0,0.55)";

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.userAgent);
}

// A shortcut's chord(s) as the help shows them: the display override if set,
// otherwise each chord formatted and joined ("Ctrl + ↓ or Esc").
function chordDisplay(s: Shortcut, mac: boolean): string {
  if (s.display) return formatChord(s.display, mac);
  return s.chords.map((c) => formatChord(c, mac)).join(" or ");
}

// Group the registry by its `group`, preserving first-seen order.
function grouped(): [string, Shortcut[]][] {
  const map = new Map<string, Shortcut[]>();
  for (const s of SHORTCUTS) {
    const arr = map.get(s.group);
    if (arr) arr.push(s);
    else map.set(s.group, [s]);
  }
  return [...map];
}

/**
 * The keyboard shortcuts reference, opened with Mod+/ (the GNOME Ctrl+?
 * convention). It renders the keymap registry, so the list a user reads is
 * exactly the one the dispatcher fires. Toggled by KEYBOARD_HELP_TOGGLE_EVENT;
 * closes on Escape or a backdrop click.
 */
export function KeyboardHelp() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [mac] = useState(isMacPlatform);

  useEffect(() => {
    const onToggle = () => {
      setOpen((v) => !v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener(KEYBOARD_HELP_TOGGLE_EVENT, onToggle);
    if (open) window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(KEYBOARD_HELP_TOGGLE_EVENT, onToggle);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const kbd: CSSProperties = {
    flexShrink: 0,
    fontFamily: "inherit",
    fontSize: 11.5,
    color: theme.palette.textSecondary,
    background: `${theme.palette.textPrimary}12`,
    borderRadius: theme.shape.small,
    padding: "2px 7px",
    whiteSpace: "nowrap",
  };

  return (
    <div
      onPointerDown={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.32)",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "82vh",
          overflowY: "auto",
          background: theme.palette.surface,
          backdropFilter: theme.blur.surface,
          WebkitBackdropFilter: theme.blur.surface,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: theme.shape.windowRadius,
          boxShadow: theme.elevation?.windowFocused ?? DEFAULT_SHADOW,
          color: theme.palette.textPrimary,
          padding: 22,
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 16 }}>Keyboard Shortcuts</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px 28px",
          }}
        >
          {grouped().map(([group, items]) => (
            <section key={group}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  color: theme.palette.textSecondary,
                }}
              >
                {group}
              </h3>
              {items.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "3px 0",
                  }}
                >
                  <span style={{ fontSize: 12.5 }}>{s.label}</span>
                  <kbd style={kbd}>{chordDisplay(s, mac)}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
