// ESLint flat config for the app bundle: main process (app/), renderer (src/) and e2e.
const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier/flat");
const globals = require("globals");
const angularPlugin = require("@angular-eslint/eslint-plugin");
const angularTemplatePlugin = require("@angular-eslint/eslint-plugin-template");
const angularTemplateParser = require("@angular-eslint/template-parser");

module.exports = defineConfig([
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "out-tsc/**",
      "app-build/**",
      "release/**",
      // Build scripts and configs at the package root, and the Node scripts under scripts/, are not part of
      // the app bundle and are not linted (they never were).
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/*.mts",
    ],
  },
  {
    files: ["src/**/*.ts", "app/**/*.ts", "e2e/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
          "./tsconfig.serve.json",
          "./src/tsconfig.app.json",
          "./src/tsconfig.spec.json",
          "./e2e/tsconfig.e2e.json",
          "./app/tsconfig.spec.json",
        ],
      },
    },
    plugins: {
      "@angular-eslint": angularPlugin,
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
      "@angular-eslint/use-injectable-provided-in": "error",
      "@angular-eslint/no-attribute-decorator": "error",
      "no-var": "error",
    },
  },
  // Shell/bundle boundary, see SHELL_BUNDLE_PLAN.md. The shell (wowup-shell) ships in the signed binary and
  // the bundle updates without it, so app code may only use the shell's published contract. The shell's
  // side of the rule is in wowup-shell/eslint.config.js.
  {
    files: ["app/**/*.ts", "src/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/wowup-shell/*", "!**/wowup-shell/contract"],
              message: "Only wowup-shell/contract/ is part of the shell's contract with app code.",
            },
          ],
        },
      ],
    },
  },
  // App code can't assume it's running from the install directory once bundles are downloaded, so files
  // are resolved through app/bundle-paths.ts.
  {
    files: ["app/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='getAppPath']",
          message: "Use app/bundle-paths.ts; the bundle may not live in the install directory.",
        },
        {
          selector: "Identifier[name=/^__(dirname|filename)$/]",
          message: "Use app/bundle-paths.ts; the bundle may not live in the install directory.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.html"],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      "@angular-eslint/template": angularTemplatePlugin,
    },
    rules: {
      "@angular-eslint/template/banana-in-box": "error",
      "@angular-eslint/template/no-negated-async": "error",
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
