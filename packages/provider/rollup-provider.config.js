const { join } = require('path')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = [
    {
        input: join(__dirname, 'web-whatsapp', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'bundle.web-whatsapp.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'twilio', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'bundle.twilio.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'mock', 'index.js'),
        output: {
            file: join(__dirname, 'lib', 'bundle.mock.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
]
