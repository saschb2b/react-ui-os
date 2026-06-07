/**
 * Imperative jump-to-section for the Settings window. The window id can't carry
 * the target section as an arg (that would fork it into a second window, since
 * `windowIdOf` folds args into the id), so a deep link is a module-level signal
 * the mounted Settings reads instead. Mirrors Windows opening Personalization >
 * Taskbar directly from the taskbar's right-click menu.
 *
 * A monotonically rising nonce lets Settings apply each request exactly once:
 * it records the nonce it last honored and ignores anything not newer, so a
 * later plain reopen (Cmd-,) leaves the user wherever they last were.
 */
let requested: { section: string; nonce: number } | null = null;
let counter = 0;
const listeners = new Set<() => void>();

/** Ask the Settings window to switch to `section` on its next read. */
export function requestSettingsSection(section: string): void {
  counter += 1;
  requested = { section, nonce: counter };
  listeners.forEach((l) => {
    l();
  });
}

/** The pending request, or null. Includes the nonce so callers de-dupe. */
export function getRequestedSection(): { section: string; nonce: number } | null {
  return requested;
}

export function subscribeSettingsNav(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
