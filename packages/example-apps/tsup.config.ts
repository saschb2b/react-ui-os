import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "@react-ui-os/core", "@react-ui-os/desktop"],
  outDir: "dist",
});
