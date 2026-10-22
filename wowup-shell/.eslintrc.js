// The TypeScript rules wowup-electron uses for its main-process code, plus the shell/bundle boundary.
// See wowup-electron/SHELL_BUNDLE_PLAN.md.
module.exports = {
  root: true,
  env: {
    node: true,
    es2017: true,
  },
  overrides: [
    {
      files: ["*.ts"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.spec.json"],
        sourceType: "module",
      },
      plugins: ["@typescript-eslint"],
      rules: {
        "@typescript-eslint/no-empty-function": 0,
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-var-requires": 0,
        "@typescript-eslint/no-unsafe-call": 0,
        "@typescript-eslint/no-unsafe-member-access": 0,
        "@typescript-eslint/no-unsafe-assignment": 0,
        "@typescript-eslint/no-unsafe-return": 0,
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
      excludedFiles: ["*.spec.ts"],
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
  ],
};
