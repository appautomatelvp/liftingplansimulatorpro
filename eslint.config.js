/** Flat ESLint config — architecture gates for app/domain layers (optional eslint install). */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**']
  },
  {
    files: ['src/app/**/*.js', 'src/shared/**/*.js', 'src/domain/**/*.js', 'src/ui/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        Date: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error'
    }
  }
];
