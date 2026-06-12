// Whether the launcher (Spotlight / app grid / Start menu) is currently open.
// A module-level signal so the dock's launcher button can highlight itself
// while the menu it opens is showing (the Windows Start button stays
// highlighted while Start is open) without the dock and the launcher sharing
// a provider. `useLauncher` pushes its open state here; the button reads it
// through useSyncExternalStore.

let open = false;
const listeners = new Set<() => void>();

export function setLauncherOpen(value: boolean): void {
  if (open === value) return;
  open = value;
  for (const listener of listeners) listener();
}

export function getLauncherOpen(): boolean {
  return open;
}

export function subscribeLauncherOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
