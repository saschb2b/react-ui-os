/**
 * Window event names emitted by the library. Consumers can dispatch these
 * from anywhere in the app to trigger system surfaces without prop-drilling.
 *
 * Example: a "Find" button in a custom menu-bar item can open Spotlight
 * with `window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT))`.
 */
export const SPOTLIGHT_OPEN_EVENT = "react-ui-os:spotlight-open";

/**
 * Toggle the Notification Center sheet. The Center component listens for
 * this so any custom menu-bar item or keyboard shortcut can open it
 * without prop drilling.
 */
export const NOTIFICATION_CENTER_TOGGLE_EVENT =
  "react-ui-os:notification-center-toggle";

/**
 * Toggle the Quick Settings popover (the GNOME system menu / macOS Control
 * Center / Windows quick settings flyout). The QuickSettings component listens
 * for this so the menu-bar status cluster, a keyboard shortcut, or any custom
 * widget can open it without prop drilling.
 */
export const QUICK_SETTINGS_TOGGLE_EVENT = "react-ui-os:quick-settings-toggle";

/**
 * Toggle Mission Control (the all-windows overview). The MissionControl
 * component listens for this, so the single keyboard dispatcher owns the open
 * chord (Ctrl+Up, F3) alongside every other global shortcut rather than running
 * a second keydown listener that could clash. Any custom widget can open the
 * overview by dispatching it.
 */
export const MISSION_CONTROL_TOGGLE_EVENT = "react-ui-os:mission-control-toggle";
