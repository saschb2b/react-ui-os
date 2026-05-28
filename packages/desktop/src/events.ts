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
