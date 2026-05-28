/**
 * Window event names emitted by the library. Consumers can dispatch these
 * from anywhere in the app to trigger system surfaces without prop-drilling.
 *
 * Example: a "Find" button in a custom menu-bar item can open Spotlight
 * with `window.dispatchEvent(new CustomEvent(SPOTLIGHT_OPEN_EVENT))`.
 */
export const SPOTLIGHT_OPEN_EVENT = "react-ui-os:spotlight-open";
