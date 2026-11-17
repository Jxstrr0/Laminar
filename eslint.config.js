// Adapted from Quench eslint.config.js (15 November 2026), which came from Lombard
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'shots/', 'node_modules/', 'public/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The offline worker runs in its own scope, not a page (PR 14a).
    files: ['src/pwa/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', '*.config.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The sim and its data tables are pure logic: no three, no DOM, no Math.random, no Date.now.
    // tests/simPurity.test.ts scans for the same things, plus the non-deterministic Math calls.
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'The sim must not import three.' },
            {
              group: ['**/render/**', '**/ui/**', '**/audio/**', '**/persist/**', '**/cfd/**'],
              message: 'The sim must stay pure.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'The sim has no wall clock.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'performance'],
    },
  },
  {
    // Saves read and write the sim's state; they never reach into the screens or the 3D.
    files: ['src/persist/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'Saves must not import three.' },
            { group: ['**/render/**', '**/ui/**', '**/audio/**'], message: 'Saves hold state, not screens.' },
          ],
        },
      ],
    },
  },
  {
    // The CFD Cluster (PR 12) is an instrument: it reads designs and its own numbers, never the screens, saves or 3D.
    files: ['src/cfd/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'The solver must not import three.' },
            { group: ['**/render/**', '**/ui/**', '**/audio/**', '**/persist/**'], message: 'The solver is an instrument, not a screen or a save.' },
          ],
        },
      ],
    },
  },
)
