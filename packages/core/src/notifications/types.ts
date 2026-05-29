import type { ComponentType, ReactNode } from "react";

/**
 * One row in the notification feed. Items live for `duration` ms as a
 * toast, then move into the Notification Center history.
 */
export interface NotificationItem {
  /** Stable id. If omitted from `notify(...)`, generated. */
  id: string;
  /** Single-line headline. */
  title: string;
  /** Optional body / detail line(s). */
  body?: string;
  /** Optional ReactNode to replace the default body (e.g. inline progress). */
  bodyNode?: ReactNode;
  /** Associates the notification with an app for dock badges + grouping. */
  appId?: string;
  /** Tile accent color. Falls back to the app's accent or the theme accent. */
  accent?: string;
  /** Lucide-style icon. Letter fallback when absent. */
  icon?: ComponentType<{ size?: number }>;
  /** Severity hint: affects accent / icon if not explicitly set. */
  level?: "info" | "success" | "warn" | "error";
  /**
   * Auto-dismiss duration in ms. `0` keeps the toast pinned until the
   * user dismisses it explicitly. Defaults to 5000 unless the level is
   * `error` (defaults to 0 / sticky).
   */
  duration?: number;
  /** Optional CTA buttons. Activating one runs onClick then dismisses. */
  actions?: NotificationAction[];
  /** Called when the toast leaves the visible stack (timeout or user dismiss). */
  onDismiss?: () => void;
  /** Wall-clock time the item was created. */
  createdAt: number;
  /** Wall-clock time the user dismissed it (closes toast, keeps history). */
  dismissedAt?: number;
  /** Marked true once the user opens Notification Center after createdAt. */
  read?: boolean;
}

export interface NotificationAction {
  label: string;
  /** Runs on click. Receives the item id in case the handler needs it. */
  onClick: (id: string) => void;
  /** Visually emphasize the primary action. */
  primary?: boolean;
}

/** Input accepted by `notify(...)`. `id` and `createdAt` are filled in. */
export type NotificationInput = Omit<
  NotificationItem,
  "id" | "createdAt" | "dismissedAt" | "read"
> & {
  id?: string;
};

/** Snapshot the store hands listeners on every change. */
export interface NotificationSnapshot {
  items: NotificationItem[];
  active: NotificationItem[];
  unreadCount: number;
  unreadByApp: Record<string, number>;
}
