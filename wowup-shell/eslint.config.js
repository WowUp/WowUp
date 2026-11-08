// The TypeScript rules wowup-electron uses for its main-process code, plus the shell/bundle boundary.
// See wowup-electron/SHELL_BUNDLE_PLAN.md.
const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier/flat");
const globals = require("globals");

module.exports = defineConfig([
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "out-tsc/**",
      "electron-build/**",
      "native/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
    ],
  },
  {
    files: ["src/**/*.ts", "contract/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.spec.json"],
      },
    },
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-var": "error",
      // The shell ships in the signed binary and the bundle updates without it, so the shell must not
      // compile in app code
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: ["**/wowup-electron/**"], message: "The shell must not import app code." }],
        },
      ],
    },
  },
  {
    // The app bundles its own copy of contract/, so contract/ must not pull in shell internals
    files: ["contract/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/wowup-electron/**"], message: "The shell must not import app code." },
            { group: ["../src/*", "**/src/*"], message: "contract/ is shared with the app; keep it self-contained." },
          ],
        },
      ],
    },
  },
  // chai's `expect(x).to.be.true` style assertions are expression statements
  {
    files: ["**/*.spec.ts"],
    rules: {
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
]);
