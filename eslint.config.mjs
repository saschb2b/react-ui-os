import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        // The React namespace is referenced in type positions (React.MouseEvent)
        // without a value import. TS resolves it from @types/react; no-undef
        // can't see that, so allowlist it like the other ambient names.
        React: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        localStorage: "readonly",
        URLSearchParams: "readonly",
        crypto: "readonly",
        process: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        StorageEvent: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        PointerEvent: "readonly",
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLUListElement: "readonly",
        HTMLCanvasElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        ImageData: "readonly",
        ResizeObserver: "readonly",
        DOMRect: "readonly",
        performance: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // Adopt the React Compiler's ESLint diagnostics incrementally. The plugin
      // ships a large set of correctness rules (refs-during-render,
      // setState-in-effect, static-components, ...) at error in
      // recommended-latest. This is a mature codebase that predates the
      // compiler, and the compiler bails out of optimizing a component it can't
      // prove safe rather than miscompiling it, so surface these as warnings
      // instead of failing the build on existing patterns. rules-of-hooks, the
      // one rule that flags genuinely broken code, stays an error.
      ...Object.fromEntries(
        Object.keys(reactHooks.configs["recommended-latest"].rules).map((name) => [
          name,
          "warn",
        ]),
      ),
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "19.0.0" } },
  },
];
