module.exports = {
  '**/*.{ts,js,json,md}': [
    'prettier --write',
    'eslint --fix --max-warnings=0'
  ]
};
