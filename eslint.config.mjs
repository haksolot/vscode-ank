import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'out', 'node_modules', '.vscode-test'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // node:test's `test()` returns a promise the runner tracks itself. Awaiting
    // each one would serialise the suite for no benefit.
    files: ['src/test/**/*.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' },
  },
);
