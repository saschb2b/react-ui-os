import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * The library packages declare a `source` condition in their `exports` field
 * that points at the raw TS in `src/`. Adding it here makes Vite resolve
 * workspace dependencies via the source files during dev (no need to
 * rebuild after every change). External consumers that don't set this
 * condition resolve via the standard `import` / `require` exports, which
 * point at the bundled `dist/` output.
 */
export default defineConfig({
  // React Compiler runs as a Babel pass. plugin-react 6 handles React Refresh
  // and JSX through Oxc and no longer carries Babel, so the compiler is wired
  // separately via @rolldown/plugin-babel + reactCompilerPreset (the setup
  // documented by @vitejs/plugin-react). React 19 ships the compiler runtime
  // (react/compiler-runtime), so reactCompilerPreset needs no target/runtime.
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    conditions: ["source"],
    // @vitejs/plugin-react 6 stopped adding these to resolve.dedupe
    // automatically, so a monorepo with multiple workspace deps could pull in
    // more than one React copy. Pin them to a single instance explicitly.
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    open: false,
  },
});
