"use client";

import { useSyncExternalStore } from "react";
import {
  getNotificationSnapshot,
  subscribeNotifications,
} from "./store";
import type { NotificationSnapshot } from "./types";

/**
 * Subscribe to the module-level notification store from React. Returns the
 * full snapshot (items, active toasts, unread counts). Components that only
 * need a slice should derive it locally — useSyncExternalStore is fine to
 * call repeatedly and the store snapshot is stable until a real change.
 */
export function useNotifications(): NotificationSnapshot {
  return useSyncExternalStore(
    subscribeNotifications,
    getNotificationSnapshot,
    getNotificationSnapshot,
  );
}
