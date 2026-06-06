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
 * fails the build if two shortcuts in the same scope claim the same chord. The
 * first clash it caught: Ctrl+Up drove both "maximize" (the snap chord matched
 * Cmd or Ctrl) and "mission control" (the macOS Ctrl+Up convention). Snap now
 * takes the Super/Win/Cmd key only (metaKey), matching Windows Win+Arrow and
 * GNOME Super+Arrow, which leaves Ctrl+Up to Mission Control.
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
    chords: ["Meta+ArrowUp"],
    label: "Maximize window",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.unmaximize",
    chords: ["Meta+ArrowDown", "Escape"],
    label: "Restore a maximized window",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapLeft",
    chords: ["Meta+ArrowLeft"],
    label: "Snap left half",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapRight",
    chords: ["Meta+ArrowRight"],
    label: "Snap right half",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapTopLeft",
    chords: ["Meta+Shift+ArrowLeft"],
    label: "Snap top-left quarter",
    group: "Window",
    scope: "desktop",
  },
  {
    id: "window.snapTopRight",
    chords: ["Meta+Shift+ArrowRight"],
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
    chords: ["Mod+Tab"],
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
    chords: ["Ctrl+ArrowUp", "F3"],
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
