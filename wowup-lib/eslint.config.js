/* eslint-env node */
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'lib/**', './eslint.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
