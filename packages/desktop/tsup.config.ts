import { defineConfig } from "tsup";
import { reactCompilerEsbuild } from "../../tooling/react-compiler-esbuild.mjs";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "react/compiler-runtime", "@react-ui-os/core"],
  esbuildPlugins: [reactCompilerEsbuild()],
  // esbuild drops "use client" when bundling; restore it so React Server
  // Components consumers (Next.js App Router) can import the components
  // without wrapping them in a client module.
  banner: { js: '"use client";' },
  outDir: "dist",
});
