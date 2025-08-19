/* eslint-disable @typescript-eslint/naming-convention */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  env: {
    node: true,
    jest: true
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'max-lines-per-function': ['warn', { max: 20, skipBlankLines: true, skipComments: true }],
    '@typescript-eslint/explicit-function-return-type': ['error'],
    '@typescript-eslint/no-explicit-any': ['error'],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-restricted-syntax': [
      'error',
      {
        selector: "ExportNamedDeclaration[declaration.declarations.length>1]",
        message: 'One export per file per project rules.'
      }
    ]
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage']
};
