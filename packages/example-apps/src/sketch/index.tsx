import type { App } from "@react-ui-os/core";
import { SketchIcon } from "@react-ui-os/icons";
import { SketchFluentIcon } from "@react-ui-os/icons";
import { SketchContent } from "./SketchContent";

export const sketchApp: App = {
  id: "sketch",
  name: "Sketch",
  tagline: "A quick drawing pad",
  accent: "#a855f7",
  icon: SketchIcon,
  icons: { fluent: SketchFluentIcon },
  defaultBounds: { w: 720, h: 540 },
  content: SketchContent,
};
