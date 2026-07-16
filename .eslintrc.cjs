module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    extends: [
        '@gravity-ui/eslint-config',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    ignorePatterns: ['dist', 'node_modules', 'src/examples', 'src/buildDocs-fixtures'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    rules: {
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        // JS-oriented rules from the shared base that fight this TS codebase:
        // import order is handled by prettier, and JSDoc is not required here.
        'sort-imports': 'off',
        'valid-jsdoc': 'off',
        'no-negated-condition': 'off',
    },
};
