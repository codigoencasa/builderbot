module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        node: true,
    },
    extends: 'eslint:recommended',
    overrides: [],
    parserOptions: {
        ecmaVersion: 'latest',
    },
    rules: {
        'no-unsafe-negation': 'off',
        'no-prototype-builtins': 'off',
        'no-useless-escape': 'off',
    },
}
