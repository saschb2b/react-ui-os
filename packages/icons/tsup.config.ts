import { defineConfig } from "tsup";
import { reactCompilerEsbuild } from "../../tooling/react-compiler-esbuild.mjs";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "react/compiler-runtime"],
  esbuildPlugins: [reactCompilerEsbuild()],
  outDir: "dist",
});
