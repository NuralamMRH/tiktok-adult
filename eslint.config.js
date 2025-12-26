module.exports = [
  {
    ignores: [
      'node_modules/**',
      'bun.lock',
      'sanity/**',
      'sanity-backend/**',
      'public/**',
      'python-scraper/.venv/**',
      '.next/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: require('@typescript-eslint/parser'),
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      react: require('eslint-plugin-react'),
      'react-hooks': require('eslint-plugin-react-hooks'),
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
    },
  },
];
