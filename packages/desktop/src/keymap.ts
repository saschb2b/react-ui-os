/**
 * The keyboard shortcut registry and its conflict detection.
 *
 * ## One chord, one action
 *
 * Real desktops keep a chord mapped to exactly one action, enforced where the
 * binding is made:
 *
 * - macOS sends a key equivalent down the responder chain; the first responder
 *   that handles it returns YES and consumes it, stopping propagation. System
 *   hot keys (Mission Control = Ctrl+Up, Spotlight = Cmd+Space) are claimed by
 *   the window server before the app, so an app cannot bind them.
 * - Windows registers global hot keys with RegisterHotKey, which fails if the
 *   chord is already taken, so two handlers can never own one chord. The shell
 *   owns the Win+Arrow snap chords.
 * - GNOME stores keybindings in GSettings; its Settings panel detects a clash
 *   on assignment ("already used for X") and reassigns, disabling the prior
 *   binding. Mutter grabs each binding once.
 *
 * The shared rule is one chord, one action. {@link SHORTCUTS} is our single
 * list of every global binding, and {@link findConflicts} (run by the test)
 * fails the build if two shortcuts in the same scope claim the same chord.
 *
 * ## The browser is not the OS
 *
 * A web desktop only ever sees the chords the browser and the host OS don't
 * claim first. The Super/Win/Cmd key (metaKey) never reaches a page on Windows
 * or GNOME, where Win+Arrow and Super+Arrow are the shell's own snap chords;
 * Cmd+Arrow, Ctrl+W, and Ctrl+1..9 are reserved by the browser itself. So we
 * cannot bind the references' literal chords. We use "Mod" (Ctrl, or Cmd on
 * macOS) for the primary modifier, which does reach the page, and accept that a
 * few combos the browser keeps (Cmd+Arrow on macOS, the tab chords) stay out of
 * reach: a native build could use the real chords, a page cannot.
 *
 * The clash this caught: Ctrl+Up drove both maximize (Mod+Arrow) and Mission
 * Control (the macOS Ctrl+Up). Maximize keeps Ctrl+Up, the chord that reaches
 * the page and the one a browser user reaches for; Mission Control drops to F3,
 * because on the desktops it imitates, the overview chords (Ctrl+Up on macOS,
 * Super/Win+Tab) are taken by the host OS before a page could ever see them.
 */

// Canonical modifier order, so a chord has one spelling no matter the press
// order: "ctrl+alt+arrowleft", never "alt+ctrl+arrowleft".
const MOD_ORDER = ["ctrl", "alt", "shift", "meta"] as const;

export interface ChordEvent {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  key: string;
}

/** Canonical chord string for a keydown event, e.g. "ctrl+arrowup", "meta+k". */
export function chordOf(e: ChordEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("ctrl");
  if (e.altKey) mods.push("alt");
  if (e.shiftKey) mods.push("shift");
  if (e.metaKey) mods.push("meta");
  return [...mods, e.key.toLowerCase()].join("+");
}

/**
 * Where a shortcut is live. "desktop" shortcuts are always active; the others
 * only while their overlay is open, so the same key (Escape, arrows) can mean
 * different things in different overlays without clashing.
 */
export type Scope = "desktop" | "mission-control" | "app-switcher" | "spotlight";

export interface Shortcut {
  id: string;
  /**
   * Chord specs. "Mod" is the primary modifier (Cmd on macOS, Ctrl elsewhere),
   * which a browser reports as metaKey or ctrlKey, so it expands to both. Other
   * tokens (Ctrl, Alt, Shift, Meta, and the key) are literal.
   */
  chords: string[];
  label: string;
  group: string;
  scope: Scope;
  /**
   * Optional override for how the chord reads in the shortcuts help, when the
   * raw chords would be unwieldy (a 1..9 range, say). A spec string like the
   * chords, run through {@link formatChord}.
   */
  display?: string;
}

/** Expand a chord spec into the concrete canonical chords it can produce. */
export function expandChord(spec: string): string[] {
  const tokens = spec.split("+").map((t) => t.trim().toLowerCase());
  const key = tokens[tokens.length - 1] ?? "";
  const mods = tokens.slice(0, -1);
  const fixed = mods.filter((m) => m !== "mod");
  const variants = mods.includes("mod") ? [["ctrl"], ["meta"]] : [[]];
  return variants.map((extra) => {
    const present = new Set([...fixed, ...extra]);
    const ordered = MOD_ORDER.filter((m) => present.has(m));
    return [...ordered, key].join("+");
  });
}

export interface Conflict {
  scope: Scope;
  chord: string;
  ids: string[];
}

/** Concrete chords claimed by more than one shortcut within the same scope. */
export function findConflicts(shortcuts: Shortcut[]): Conflict[] {
  const byScope = new Map<Scope, Map<string, Set<string>>>();
  for (const s of shortcuts) {
    let scoped = byScope.get(s.scope);
    if (!scoped) {
      scoped = new Map();
      byScope.set(s.scope, scoped);
    }
    for (const spec of s.chords) {
      for (const chord of expandChord(spec)) {
        let ids = scoped.get(chord);
        if (!ids) {
          ids = new Set();
          scoped.set(chord, ids);
        }
        ids.add(s.id);
      }
    }
  }
  const conflicts: Conflict[] = [];
  for (const [scope, scoped] of byScope) {
    for (const [chord, ids] of scoped) {
      if (ids.size > 1) conflicts.push({ scope, chord, ids: [...ids] });
    }
  }
  return conflicts;
}

/**
 * Every keyboard shortcut the desktop binds, listed once. Keep it in step with
 * the handlers (KeyboardShortcuts, MissionControl, AppSwitcher); the conflict
 * test guards that no two in a scope collide.
 */
export const SHORTCUTS: Shortcut[] = [
  // Windows
  {
    id: "window.close",
    chords: ["Mod+W"],
    label: "Close window",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.minimize",
    chords: ["Mod+M"],
    label: "Minimize window",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.maximize",
    chords: ["Mod+ArrowUp"],
    label: "Maximize window",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.unmaximize",
    chords: ["Mod+ArrowDown", "Escape"],
    label: "Restore a maximized window",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapLeft",
    chords: ["Mod+ArrowLeft"],
    label: "Snap left half",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapRight",
    chords: ["Mod+ArrowRight"],
    label: "Snap right half",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapTopLeft",
    chords: ["Mod+Shift+ArrowLeft"],
    label: "Snap top-left quarter",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapTopRight",
    chords: ["Mod+Shift+ArrowRight"],
    label: "Snap top-right quarter",
    group: "Window",
    scope: "desktop",
  },
  // Apps
  {
    id: "app.spotlight",
    chords: ["Mod+K"],
    label: "Open Spotlight",
    group: "Apps",
    scope: "desktop",
  },
  {
    id: "app.settings",
    chords: ["Mod+,"],
    label: "Open Settings",
    group: "Apps",
    scope: "desktop",
  },
  {
    id: "app.switcher",
    chords: ["Mod+Tab", "Mod+Shift+Tab"],
    label: "Application switcher",
    group: "Apps",
    scope: "desktop",
  },
  {
    id: "app.byIndex",
    chords: [
      "Mod+1",
      "Mod+2",
      "Mod+3",
      "Mod+4",
      "Mod+5",
      "Mod+6",
      "Mod+7",
      "Mod+8",
      "Mod+9",
    ],
    label: "Open / focus / cycle app 1 to 9",
    group: "Apps",
    scope: "desktop",
    display: "Mod+1–9",
  },
  {
    id: "app.help",
    // Mod+/ and Mod+Shift+/ (which is Ctrl+?, the GNOME convention). The second
    // also catches layouts where "/" needs Shift: on a German keyboard "/" is
    // Shift+7, so pressing "Ctrl+/" arrives as ctrl+shift+/. A right-click
    // desktop menu item opens it too, for layouts neither chord reaches.
    chords: ["Mod+/", "Mod+Shift+/"],
    label: "Keyboard shortcuts",
    group: "Apps",
    scope: "desktop",
    display: "Mod+/",
  },
  // Spaces
  {
    id: "space.prev",
    chords: ["Ctrl+Alt+ArrowLeft"],
    label: "Previous workspace",
    group: "Spaces",
    scope: "desktop",
  },
  {
    id: "space.next",
    chords: ["Ctrl+Alt+ArrowRight"],
    label: "Next workspace",
    group: "Spaces",
    scope: "desktop",
  },
  {
    id: "space.movePrev",
    chords: ["Ctrl+Alt+Shift+ArrowLeft"],
    label: "Move window to previous workspace",
    group: "Spaces",
    scope: "desktop",
  },
  {
    id: "space.moveNext",
    chords: ["Ctrl+Alt+Shift+ArrowRight"],
    label: "Move window to next workspace",
    group: "Spaces",
    scope: "desktop",
  },
  {
    id: "space.missionControl",
    chords: ["F3"],
    label: "Mission Control",
    group: "Spaces",
    scope: "desktop",
  },
  // In-overlay navigation, each live only while its overlay is open
  {
    id: "missionControl.close",
    chords: ["Escape"],
    label: "Close Mission Control",
    group: "Mission Control",
    scope: "mission-control",
  },
  {
    id: "missionControl.move",
    chords: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
    label: "Move selection",
    group: "Mission Control",
    scope: "mission-control",
  },
  {
    id: "appSwitcher.cancel",
    chords: ["Escape"],
    label: "Cancel switching",
    group: "App switcher",
    scope: "app-switcher",
  },
  {
    id: "spotlight.close",
    chords: ["Escape"],
    label: "Close Spotlight",
    group: "Spotlight",
    scope: "spotlight",
  },
];

const BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s]));

/**
 * Whether a keydown matches the shortcut with this id. The dispatcher gates
 * each branch on this instead of hardcoding modifiers, so the chords come from
 * the registry above (and the conflict test therefore guards the real combos).
 */
export function chordMatches(e: ChordEvent, id: string): boolean {
  const shortcut = BY_ID.get(id);
  if (!shortcut) return false;
  const chord = chordOf(e);
  return shortcut.chords.some((spec) => expandChord(spec).includes(chord));
}

const MAC_SYMBOL: Record<string, string> = {
  mod: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
};
const PC_WORD: Record<string, string> = {
  mod: "Ctrl",
  meta: "Super",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};
const KEY_LABEL: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  escape: "Esc",
};

/**
 * Render a chord spec for the shortcuts help: macOS-style glued symbols
 * (⌘⇧K) when `mac`, spaced words otherwise (Ctrl + Shift + K).
 * Modifiers map to the platform's key, "Mod" included; arrows and Escape get
 * glyphs; a single letter is uppercased.
 */
export function formatChord(spec: string, mac: boolean): string {
  const tokens = spec.split("+");
  const last = tokens.length - 1;
  const parts = tokens.map((raw, i) => {
    const token = raw.trim();
    const low = token.toLowerCase();
    if (i < last) return (mac ? MAC_SYMBOL[low] : PC_WORD[low]) ?? token;
    return KEY_LABEL[low] ?? (token.length === 1 ? token.toUpperCase() : token);
  });
  return parts.join(mac ? "" : " + ");
}
