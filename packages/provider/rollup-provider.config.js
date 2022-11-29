const { join } = require('path')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = [
    {
        input: join(__dirname, 'src', 'web-whatsapp', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'web-whatsapp', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'twilio', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'twilio', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'mock', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'mock', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
]
