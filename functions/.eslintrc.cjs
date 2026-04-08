module.exports = {
  root: true,
  ignorePatterns: [
    'coverage/**',
    'lib/**',
    'node_modules/**',
    'src/api/generated/**',
  ],
  overrides: [
    {
      files: ['**/*.{js,cjs,mjs}'],
      extends: ['eslint:recommended', 'prettier'],
      env: {
        es2022: true,
        node: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
      rules: {
        'linebreak-style': ['error', 'unix'],
      },
    },
    {
      files: ['src/**/*.ts', 'tests/**/*.ts', 'vitest.config.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'prettier',
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            fixStyle: 'inline-type-imports',
          },
        ],
        'no-duplicate-imports': 'error',
        'linebreak-style': ['error', 'unix'],
      },
    },
  ],
};
