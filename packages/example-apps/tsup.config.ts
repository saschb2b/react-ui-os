import { defineConfig } from "tsup";
import { reactCompilerEsbuild } from "../../tooling/react-compiler-esbuild.mjs";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    "react",
    "react-dom",
    "react/compiler-runtime",
    "@react-ui-os/core",
    "@react-ui-os/icons",
    "@react-ui-os/desktop",
  ],
  esbuildPlugins: [reactCompilerEsbuild()],
  // esbuild drops "use client" when bundling; restore it so React Server
  // Components consumers can import the apps without a client wrapper.
  banner: { js: '"use client";' },
  outDir: "dist",
});
