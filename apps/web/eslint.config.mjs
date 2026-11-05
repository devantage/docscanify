import nx from '@nx/eslint-plugin';
import globals from 'globals';

import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Props and context values are plain objects of functions, never bound to `this`, so
      // destructuring them is safe; with method-signature-style every one of them would be flagged
      '@typescript-eslint/unbound-method': 'off',
      // Numbers in template strings (sizes, coordinates, indexes) are always safe to interpolate
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    ignores: ['public'],
  },
];
