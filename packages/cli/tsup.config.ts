import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node18",
  clean: true,
  // The output is the bin; mark it executable across platforms via the shebang.
  banner: { js: "#!/usr/bin/env node" },
  outDir: "dist",
});
