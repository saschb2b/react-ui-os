import type { App } from "@react-ui-os/core";
import { CalculatorContent } from "./Calculator";
import { CalculatorIcon } from "./icon";

export const calculatorApp: App = {
  id: "calculator",
  name: "Calculator",
  tagline: "Arithmetic and conversions",
  accent: "#22c55e",
  icon: CalculatorIcon,
  // macOS Calculator basic mode is tall and narrow.
  defaultBounds: { w: 300, h: 440 },
  content: CalculatorContent,
};
