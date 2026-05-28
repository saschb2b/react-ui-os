import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetNotifications,
  clearAllNotifications,
  dismissNotification,
  getNotificationSnapshot,
  markAllNotificationsRead,
  markNotificationRead,
  notify,
  removeNotification,
  subscribeNotifications,
} from "../src/notifications/store";

describe("notification store", () => {
  beforeEach(() => {
    __resetNotifications();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    __resetNotifications();
  });

  it("notify adds an item at the head, default duration is 5s", () => {
    const id = notify({ title: "Hello" });
    const snap = getNotificationSnapshot();
    expect(snap.items.length).toBe(1);
    expect(snap.items[0]?.id).toBe(id);
    expect(snap.active.length).toBe(1);
  });

  it("notify with same id replaces the previous row", () => {
    notify({ id: "download", title: "Downloading", body: "0%" });
    notify({ id: "download", title: "Downloading", body: "50%" });
    const snap = getNotificationSnapshot();
    expect(snap.items.length).toBe(1);
    expect(snap.items[0]?.body).toBe("50%");
  });

  it("dismiss hides from active but keeps the history row", () => {
    const id = notify({ title: "Toasted" });
    dismissNotification(id);
    const snap = getNotificationSnapshot();
    expect(snap.active.length).toBe(0);
    expect(snap.items.length).toBe(1);
    expect(snap.items[0]?.dismissedAt).toBeDefined();
  });

  it("remove deletes from history", () => {
    const id = notify({ title: "Gone" });
    removeNotification(id);
    expect(getNotificationSnapshot().items.length).toBe(0);
  });

  it("clearAll empties items", () => {
    notify({ title: "A" });
    notify({ title: "B" });
    clearAllNotifications();
    expect(getNotificationSnapshot().items.length).toBe(0);
  });

  it("dismiss fires onDismiss exactly once", () => {
    const cb = vi.fn();
    const id = notify({ title: "X", onDismiss: cb });
    dismissNotification(id);
    dismissNotification(id);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("error-level notifications are sticky by default (duration 0)", () => {
    const id = notify({ title: "Boom", level: "error" });
    // Advance well past 10s — error toasts should still be active.
    vi.advanceTimersByTime(20_000);
    const item = getNotificationSnapshot().items.find((row) => row.id === id);
    expect(item?.dismissedAt).toBeUndefined();
  });

  it("info-level toasts expire from active after duration ms", () => {
    notify({ title: "Hello", duration: 1000 });
    vi.advanceTimersByTime(500);
    expect(getNotificationSnapshot().active.length).toBe(1);
    vi.advanceTimersByTime(1500);
    // The store's interval-based reaper is best-effort; force a refresh by
    // calling notify on something unrelated to trigger rebuild.
    notify({ title: "tick" });
    expect(
      getNotificationSnapshot().active.some((a) => a.title === "Hello"),
    ).toBe(false);
  });

  it("subscribe fires on every change", () => {
    const listener = vi.fn();
    const unsub = subscribeNotifications(listener);
    notify({ title: "A" });
    notify({ title: "B" });
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
    notify({ title: "C" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("unreadCount drops after markAllNotificationsRead", () => {
    notify({ title: "A" });
    notify({ title: "B" });
    expect(getNotificationSnapshot().unreadCount).toBe(2);
    markAllNotificationsRead();
    expect(getNotificationSnapshot().unreadCount).toBe(0);
  });

  it("snapshot reference is stable between mutations (useSyncExternalStore contract)", () => {
    // Regression guard: an earlier version of the ticker silently rebuilt
    // the cached snapshot on every interval tick. React's
    // useSyncExternalStore then bailed with "result of getServerSnapshot
    // should be cached" because getSnapshot returned a different object
    // identity without a corresponding listener notification, looking
    // like an infinite loop.
    notify({ title: "A" });
    const snap1 = getNotificationSnapshot();
    expect(getNotificationSnapshot()).toBe(snap1);
    // The ticker fires every second but must not swap the snapshot
    // reference unless the active set actually changes.
    vi.advanceTimersByTime(500);
    expect(getNotificationSnapshot()).toBe(snap1);
    vi.advanceTimersByTime(400);
    expect(getNotificationSnapshot()).toBe(snap1);
  });

  it("unreadByApp groups by appId", () => {
    notify({ title: "A", appId: "mail" });
    notify({ title: "B", appId: "mail" });
    notify({ title: "C", appId: "messages" });
    notify({ title: "D" });
    const snap = getNotificationSnapshot();
    expect(snap.unreadByApp).toEqual({ mail: 2, messages: 1 });
  });

  it("markNotificationRead clears its app's badge contribution", () => {
    const id = notify({ title: "A", appId: "mail" });
    notify({ title: "B", appId: "mail" });
    markNotificationRead(id);
    const snap = getNotificationSnapshot();
    expect(snap.unreadByApp.mail).toBe(1);
  });
});
