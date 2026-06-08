import type { App } from "@react-ui-os/core";
import { TerminalContent } from "./Terminal";
import { TerminalIcon } from "@react-ui-os/icons";
import { TerminalFluentIcon } from "@react-ui-os/icons";

export const terminalApp: App = {
  id: "terminal",
  name: "Terminal",
  tagline: "A small command shell",
  accent: "#06b6d4",
  icon: TerminalIcon,
  icons: { fluent: TerminalFluentIcon },
  // macOS Terminal opens at 80x24 characters; this is a roughly equivalent
  // landscape window for the monospace surface.
  defaultBounds: { w: 640, h: 420 },
  content: TerminalContent,
};
