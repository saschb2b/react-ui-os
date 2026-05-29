import type {
  NotificationInput,
  NotificationItem,
  NotificationSnapshot,
} from "./types";

/**
 * Module-level notification store. Owns an ordered list (newest first) and
 * notifies subscribers on every change. The store is intentionally outside
 * React so any code (a fetch handler, an effect, a service worker) can
 * call `notify(...)` without prop-drilling a dispatcher.
 *
 * Snapshots are deeply cloned on every change so `useSyncExternalStore`
 * detects updates without us having to micromanage referential identity.
 */

let items: NotificationItem[] = [];
const listeners = new Set<(snapshot: NotificationSnapshot) => void>();
let cachedSnapshot: NotificationSnapshot = {
  items: [],
  active: [],
  unreadCount: 0,
  unreadByApp: {},
};

const TICK_MS = 1000;
let tickHandle: ReturnType<typeof setInterval> | null = null;

function defaultDurationFor(level: NotificationItem["level"]): number {
  // Errors stick until acknowledged. Warnings linger longer than info /
  // success. These thresholds come from sampling macOS / Windows toast
  // behavior; tune later if needed.
  if (level === "error") return 0;
  if (level === "warn") return 8000;
  return 5000;
}

function rebuildSnapshot(): void {
  const now = Date.now();
  const active = items.filter((item) => {
    if (item.dismissedAt) return false;
    const duration = item.duration ?? defaultDurationFor(item.level);
    if (duration === 0) return true;
    return now - item.createdAt < duration;
  });
  const unreadCount = items.reduce((acc, item) => (item.read ? acc : acc + 1), 0);
  const unreadByApp = items.reduce<Record<string, number>>((acc, item) => {
    if (item.read || !item.appId) return acc;
    acc[item.appId] = (acc[item.appId] ?? 0) + 1;
    return acc;
  }, {});
  cachedSnapshot = { items: [...items], active, unreadCount, unreadByApp };
}

function emit(): void {
  rebuildSnapshot();
  for (const listener of listeners) listener(cachedSnapshot);
}

/**
 * Recompute the active count from `items` without touching the cached
 * snapshot. Used by the ticker to decide whether anything has changed
 * before paying for a rebuild + emit. Mirrors the filter inside
 * `rebuildSnapshot` exactly.
 */
function computeActiveCount(): number {
  const now = Date.now();
  let count = 0;
  for (const item of items) {
    if (item.dismissedAt) continue;
    const duration = item.duration ?? defaultDurationFor(item.level);
    if (duration === 0 || now - item.createdAt < duration) count += 1;
  }
  return count;
}

function ensureTickerRunning(): void {
  if (tickHandle || typeof window === "undefined") return;
  tickHandle = setInterval(() => {
    // The cached snapshot is what `useSyncExternalStore`'s getSnapshot
    // returns; it MUST stay referentially stable between notifications.
    // Earlier this function rebuilt the snapshot every tick and only
    // emitted when the active count changed. That silently swapped the
    // cached reference, so React would see a fresh object on a
    // post-render getSnapshot call without a matching listener fire and
    // bail with "result of getServerSnapshot should be cached" (an
    // infinite render loop). Now: compute cheaply, only rebuild + emit
    // when something would actually change.
    if (cachedSnapshot.active.length === 0) {
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
      return;
    }
    if (computeActiveCount() !== cachedSnapshot.active.length) {
      emit();
    }
  }, TICK_MS);
}

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  // Combining wall clock + a counter is safe across SSR rehydration and
  // bursty calls within the same millisecond.
  return `n${String(Date.now())}-${String(idCounter)}`;
}

/**
 * Push a notification onto the feed. Returns the assigned id so callers
 * can later update or dismiss the same row (`notify({ id: "downloading", ... })`
 * twice in a row replaces the first item rather than stacking).
 */
export function notify(input: NotificationInput): string {
  const id = input.id ?? generateId();
  const existingIdx = items.findIndex((row) => row.id === id);
  const next: NotificationItem = {
    ...input,
    id,
    createdAt: Date.now(),
    dismissedAt: undefined,
    read: false,
  };
  if (existingIdx >= 0) {
    // Re-injecting the same id resets the toast lifecycle. Useful for
    // long-running progress notifications that update over time.
    items = [...items.slice(0, existingIdx), next, ...items.slice(existingIdx + 1)];
  } else {
    items = [next, ...items];
  }
  emit();
  ensureTickerRunning();
  return id;
}

/**
 * Hide the toast and the Center entry. Fires `onDismiss` once if provided.
 */
export function dismissNotification(id: string): void {
  const item = items.find((row) => row.id === id);
  if (!item || item.dismissedAt) return;
  item.onDismiss?.();
  items = items.map((row) =>
    row.id === id ? { ...row, dismissedAt: Date.now() } : row,
  );
  emit();
}

/**
 * Same as `dismissNotification` but also removes the item from the
 * Notification Center history.
 */
export function removeNotification(id: string): void {
  const item = items.find((row) => row.id === id);
  if (!item) return;
  if (!item.dismissedAt) item.onDismiss?.();
  items = items.filter((row) => row.id !== id);
  emit();
}

/** Empty the Center; any visible toasts are also dismissed. */
export function clearAllNotifications(): void {
  for (const item of items) {
    if (!item.dismissedAt) item.onDismiss?.();
  }
  items = [];
  emit();
}

/** Mark a single notification read. Called when the Center is opened. */
export function markNotificationRead(id: string): void {
  const idx = items.findIndex((row) => row.id === id);
  if (idx < 0 || items[idx]?.read) return;
  items = items.map((row) => (row.id === id ? { ...row, read: true } : row));
  emit();
}

/** Mark every notification read in one shot. */
export function markAllNotificationsRead(): void {
  if (items.every((item) => item.read)) return;
  items = items.map((row) => (row.read ? row : { ...row, read: true }));
  emit();
}

export function getNotificationSnapshot(): NotificationSnapshot {
  return cachedSnapshot;
}

export function subscribeNotifications(
  listener: (snapshot: NotificationSnapshot) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reset for tests. Not exported from the package barrel, only consumed
 * from the package's own test suite.
 */
export function __resetNotifications(): void {
  items = [];
  cachedSnapshot = {
    items: [],
    active: [],
    unreadCount: 0,
    unreadByApp: {},
  };
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}
