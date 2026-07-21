import globals from 'globals'
import pluginJs from '@eslint/js'
import html from 'eslint-plugin-html'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/**',
      '.shopify/**',
      'dist/**',
      'build/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: globals.browser,
    },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-duplicate-imports': 'error',
      'no-unneeded-ternary': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
    },
  },
  {
    files: ['**/*.liquid'],
    plugins: { html },
    settings: {
      'html/html-extensions': ['.liquid'],
    },
    rules: {
      'max-len': ['error', { code: 400 }],
    },
  },
]
