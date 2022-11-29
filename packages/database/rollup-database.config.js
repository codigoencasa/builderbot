const commonjs = require('@rollup/plugin-commonjs')
const { join } = require('path')

module.exports = [
    {
        input: join(__dirname, 'src', 'mock', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'mock', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'mongo', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'mongo', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
]
