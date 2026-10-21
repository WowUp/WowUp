module.exports = {
  env: {
    browser: true,
    node: true,
    es6: true,
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
        ecmaVersion: 10,
        tsconfigRootDir: __dirname,
        project: [
          "./tsconfig.serve.json",
          "./src/tsconfig.app.json",
          "./src/tsconfig.spec.json",
          "./e2e/tsconfig.e2e.json",
          "./app/tsconfig.spec.json",
        ],
        sourceType: "module",
        ecmaFeatures: {
          modules: true,
        },
      },
      plugins: ["@typescript-eslint", "@angular-eslint/eslint-plugin"],
      rules: {
        "@typescript-eslint/indent": [
          "error",
          2,
          {
            SwitchCase: 1,
            CallExpression: { arguments: "first" },
            FunctionExpression: { parameters: "first" },
            FunctionDeclaration: { parameters: "first" },
          },
        ],
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
        "@angular-eslint/use-injectable-provided-in": "error",
        "@angular-eslint/no-attribute-decorator": "error",
        "no-var": "error",
      },
    },
    // Shell/bundle boundary, see SHELL_BUNDLE_PLAN.md. The shell ships in the signed binary and the bundle
    // updates without it, so the shell must not compile in app code, and app code may only use the shell's
    // published contract.
    {
      files: ["app/shell/**/*.ts"],
      excludedFiles: ["*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["../*"],
                message: "app/shell must not import app code; only files inside app/shell, packages and built-ins.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["app/**/*.ts", "src/**/*.ts"],
      excludedFiles: ["app/shell/**", "*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/shell/*", "!**/shell/shell-api", "!**/shell/protocol-client"],
                message: "Only shell-api and protocol-client are part of the shell's contract with app code.",
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
      excludedFiles: ["app/shell/**", "app/bundle-paths.ts", "*.spec.ts"],
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
      files: ["*.component.html"],
      parser: "@angular-eslint/template-parser",
      plugins: ["@angular-eslint/template"],
      rules: {
        "@angular-eslint/template/banana-in-box": "error",
        "@angular-eslint/template/no-negated-async": "error",
      },
    },
  ],
};
