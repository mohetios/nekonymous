import ESLint from "@eslint/js";
import ESLintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/",
      ".wrangler/",
      "dist/",
      "pnpm-lock.yaml",
      "**/*.ts",
    ],
  },
  ESLint.configs.recommended,
  ESLintConfigPrettier,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
