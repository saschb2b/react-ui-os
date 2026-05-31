import { readFile } from "node:fs/promises";
import { transformAsync } from "@babel/core";
import presetTypeScript from "@babel/preset-typescript";
import reactCompiler from "babel-plugin-react-compiler";

/**
 * esbuild plugin that runs babel-plugin-react-compiler over a package's own
 * TS/TSX source. tsup bundles with esbuild, which can't run Babel plugins, so
 * this is the bridge that lets the published `dist/` ship pre-optimized
 * components (see react.dev "Compiling Libraries"). The compiler runs first on
 * the original source; Babel strips the TS types and leaves the JSX for esbuild
 * to lower, matching how tsup handled these files before.
 *
 * The library packages peer-depend on React 19, whose compiler runtime is built
 * in (react/compiler-runtime), so target "19" and no runtime dependency. The
 * compiler skips any component it can't prove safe rather than throwing, so a
 * bail-out never breaks the build.
 */
export function reactCompilerEsbuild() {
  return {
    name: "react-compiler",
    setup(build) {
      build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
        if (args.path.includes("node_modules")) return null;
        const isTSX = args.path.endsWith(".tsx");
        const source = await readFile(args.path, "utf8");
        const result = await transformAsync(source, {
          filename: args.path,
          babelrc: false,
          configFile: false,
          sourceMaps: "inline",
          presets: [
            [presetTypeScript, { isTSX, allExtensions: true, allowDeclareFields: true }],
          ],
          plugins: [[reactCompiler, { target: "19" }]],
        });
        if (!result?.code) return null;
        return { contents: result.code, loader: isTSX ? "jsx" : "js" };
      });
    },
  };
}
