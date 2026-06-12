import { defineConfig, type Options } from "tsup";
import { reactCompilerEsbuild } from "../../tooling/react-compiler-esbuild.mjs";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  external: ["react", "react-dom", "react/compiler-runtime"],
  esbuildPlugins: [reactCompilerEsbuild()],
  outDir: "dist",
};

// esbuild drops "use client" directives when bundling, so the banner restores
// the directive on the entries that ship hooks or context (required for React
// Server Components consumers, e.g. Next.js App Router). Storage and settings
// are pure logic and build without it, so server code can import them without
// crossing a client boundary. tsup runs the two configs in parallel; only the
// first cleans, and its clean runs at startup before either config emits.
export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      "window-manager/index": "src/window-manager/index.ts",
      "notifications/index": "src/notifications/index.ts",
    },
    banner: { js: '"use client";' },
    clean: true,
  },
  {
    ...shared,
    entry: {
      "storage/index": "src/storage/index.ts",
      "settings/index": "src/settings/index.ts",
    },
    clean: false,
  },
]);
