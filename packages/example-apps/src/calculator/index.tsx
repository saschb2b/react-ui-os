import type { App } from "@react-ui-os/core";
import { CalculatorContent } from "./Calculator";
import { CalculatorIcon } from "@react-ui-os/icons";
import { CalculatorFluentIcon } from "@react-ui-os/icons";

export const calculatorApp: App = {
  id: "calculator",
  name: "Calculator",
  tagline: "Arithmetic and conversions",
  accent: "#22c55e",
  icon: CalculatorIcon,
  icons: { fluent: CalculatorFluentIcon },
  // macOS Calculator basic mode is tall and narrow.
  defaultBounds: { w: 300, h: 440 },
  content: CalculatorContent,
};
