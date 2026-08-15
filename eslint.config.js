import js from '@eslint/js'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

/**
 * ESLint flat config. P0-5.
 *
 * Scope note: `typescript-eslint` is not installed. It peer-requires
 * TypeScript `<6.1.0` and this repo pins `^7.0.2`, so adding it today would
 * mean forcing a knowingly-broken resolution. `src/**` (TS/TSX) is therefore
 * covered by `tsc --noEmit` and Prettier rather than ESLint. Revisit when
 * typescript-eslint supports TypeScript 7.
 *
 * Rules are chosen to catch defects, not to enforce style — formatting belongs
 * to Prettier, and `eslint-config-prettier` disables any rule that would fight
 * it. Several rules here exist because of specific findings in
 * `docs/reviews/REVIEW-001-mvp-security.md`.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'release/**',
      // An unrelated project sitting untracked in the working tree. ESLint 10
      // walks into it, finds its own config, and dies on a plugin this repo
      // does not install. Not ours to lint.
      'Handy-main/**',
      // TypeScript is covered by `tsc --noEmit`, not ESLint — see scope note.
      'src/**',
      '**/*.ts',
      '**/*.tsx',
      '**/*.mts'
    ]
  },

  js.configs.recommended,

  // Main process, shared packages and build scripts: CommonJS on Node.
  {
    files: ['electron/**/*.cjs', 'packages/**/*.cjs', 'scripts/**/*.cjs', 'esbuild.preload.cjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      // REVIEW-001 H1/H2 were unguarded dynamic key lookups used as
      // allow-lists. This does not catch that class directly, but it does stop
      // the prototype-builtin calls that make it easy to get wrong.
      'no-prototype-builtins': 'error',

      // The runtime must never execute model-supplied or file-supplied code.
      // AGENTS.md rules 10 and 11.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // A swallowed error in a privileged path hides a failed security check.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Unused values in this codebase have twice turned out to be dead
      // privileged wiring rather than harmless leftovers.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      'no-return-await': 'error'
    }
  },

  // Tests: same rules, plus the node:test globals.
  {
    files: ['tests/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }] // deliberate in negative tests
    }
  },

  // Config files that are ES modules.
  {
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },

  // Must stay last so it can switch off anything that conflicts with Prettier.
  prettier
]
