import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist', '**/*.ts', '**/*.tsx'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  }
];
