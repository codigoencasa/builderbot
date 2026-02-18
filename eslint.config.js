const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const importPlugin = require('eslint-plugin-import')

module.exports = tseslint.config(
    {
        ignores: [
            'node_modules/',
            'starters/',
            '__test__',
            'base-**',
            '_test_',
            '*.js',
            'dist/',
            'coverage/',
            '**/node_modules/**',
            '**/dist/**',
            '**/*.config.js',
            '**/*.cjs',
            '**/bin/**',
            'scripts/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                console: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                Buffer: 'readonly',
                global: 'readonly',
            },
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            'import/order': [
                'error',
                {
                    groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
                    'newlines-between': 'always',
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            'no-useless-escape': 'off',
            'import/named': 'off',
            'import/no-named-as-default-member': 'off',
            '@typescript-eslint/ban-types': 'off',
            'no-prototype-builtins': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'import/no-unresolved': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
        },
    },
    {
        files: ['packages/**/*.ts'],
        rules: {
            'no-unsafe-negation': 'off',
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'off',
        },
    }
)
