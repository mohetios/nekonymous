import ESLint from "@eslint/js";
import ESLintConfigPrettier from "eslint-config-prettier";
import Oxlint from "eslint-plugin-oxlint";
import globals from "globals";
import TSESLint from "typescript-eslint";

export default TSESLint.config(
  {
    ignores: [
      "node_modules/",
      ".wrangler/",
      "dist/",
      "pnpm-lock.yaml",
    ],
  },
  ESLint.configs.recommended,
  ...TSESLint.configs.recommended,
  Oxlint.configs["flat/recommended"],
  ESLintConfigPrettier,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.worker,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [...TSESLint.configs.recommendedTypeChecked],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-unused-private-class-members": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  }
);
