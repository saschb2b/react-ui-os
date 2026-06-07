import type { App } from "@react-ui-os/core";
import { notesApp } from "./notes";
import { calculatorApp } from "./calculator";
import { clockApp } from "./clock";
import { calendarApp } from "./calendar";
import { remindersApp } from "./reminders";
import { sketchApp } from "./sketch";
import { terminalApp } from "./terminal";

export { notesApp } from "./notes";
export { calculatorApp } from "./calculator";
export { clockApp } from "./clock";
export { calendarApp } from "./calendar";
export { remindersApp } from "./reminders";
export { sketchApp } from "./sketch";
export { terminalApp } from "./terminal";
export * from "./fluent-icons";

/**
 * The example apps in dock order. A host composes its own app list as
 * `[helloApp, ...exampleApps]`: the Hello intro stays per-surface so the
 * playground and the docs demo can each carry their own welcome window.
 */
export const exampleApps: App[] = [
  notesApp,
  calculatorApp,
  clockApp,
  calendarApp,
  remindersApp,
  sketchApp,
  terminalApp,
];
